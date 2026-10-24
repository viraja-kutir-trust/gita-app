"""Task 1+2: rebuild sloka structure (speaker, padas, meter, display lines),
cross-checked against Besant 1922 (Wikisource) and DCS, plus IAST and search keys.

Input : src/gita-data/verse.json, scripts/out/opensource/{besant..,dcs..}
Output: scripts/out/build/verses.json
        scripts/out/formatting_changes.md
"""
import difflib
import json
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
import deva as D  # noqa: E402
from overrides import TEXT_OVERRIDES, SPEAKER_POSITION, STRUCTURE_OVERRIDES  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OS_DIR = os.path.join(ROOT, "scripts", "out", "opensource")
OUT_DIR = os.path.join(ROOT, "scripts", "out", "build")

SPEAKER_RE = re.compile(
    r"^\s*(धृतराष्ट्र\s*उवाच|स[ञं]्?\s*जय\s*उवाच|सञ्जय\s*उवाच|अर्जुन\s*उवाच|श्री\s*भगवानुवाच)\s*[।|:]*\s*"
)
SPEAKER_NORM = {
    "धृतराष्ट्र": "धृतराष्ट्र उवाच",
    "सञ्जय": "सञ्जय उवाच",
    "संजय": "सञ्जय उवाच",
    "अर्जुन": "अर्जुन उवाच",
    "श्री": "श्रीभगवानुवाच",
}
SPEAKER_EN = {
    "धृतराष्ट्र उवाच": "Dhritarashtra said",
    "सञ्जय उवाच": "Sanjaya said",
    "अर्जुन उवाच": "Arjuna said",
    "श्रीभगवानुवाच": "The Blessed Lord said",
}


def norm_speaker(s):
    s = s.strip()
    for k, v in SPEAKER_NORM.items():
        if s.startswith(k):
            return v
    raise ValueError(s)


# ------------------------------------------------------------------ typo rules
TYPO_RULES = [
    # (regex, replacement, reason)
    (re.compile(r"([क-ह])्ि([क-ह])"), r"\1्\2ि", "broken conjunct encoding (i-matra typed before 2nd consonant)"),
    (re.compile(r"([क-ह])ि्([क-ह])"), r"\1्\2ि", "broken conjunct encoding (i-matra typed before virama)"),
    (re.compile("ृ़"), "ॄ", "ṝ encoded as ृ + nukta"),
    (re.compile("([ािीुूृेैोौ])\\1"), r"\1", "doubled vowel sign"),
    (re.compile("श्रृ"), "शृ", "Hindi-style spelling श्रृ for Sanskrit शृ (śṛ)"),
]


def apply_typo_rules(t, log):
    for rx, rep, why in TYPO_RULES:
        for m in rx.finditer(t):
            log.append(("typo", m.group(0), rx.sub(rep, m.group(0)), why))
        t = rx.sub(rep, t)
    return t


# ------------------------------------------------------------------ parsing
def parse_current(text):
    """-> speaker, body (str), joints [(pos_in_body, kind)] kind in danda|nl"""
    t = text.replace("‌", "").replace("‍", "")
    t = re.sub(r"[।|॥]*\s*\d+\s*\.\s*\d+\s*[।|॥]*\s*$", "", t.strip())
    t = t.replace("॥", "।")
    speaker = None
    m = SPEAKER_RE.match(t)
    if m:
        speaker = norm_speaker(m.group(1))
        glued = not re.match(r"\s*[।\n]", t[m.end(1):]) and t[m.end(1):m.end(1) + 1] not in ("\n",)
        t = t[m.end():]
    else:
        glued = False
    parts = re.split(r"(\s*[।]+\s*|\s*\n+\s*)", t.strip())
    body, joints = "", []
    for i, p in enumerate(parts):
        if i % 2 == 0:
            body += p.strip()
        else:
            if i == len(parts) - 1 or not parts[i + 1].strip():
                continue
            kind = "danda" if "।" in p else "nl"
            joints.append((len(body), kind))
            body += " "
    body = re.sub(" +", " ", body).strip()
    return speaker, body, joints, glued


def parse_besant(rec):
    speaker, speaker_line, lines = None, None, []
    for i, l in enumerate(rec["sanskrit_lines"]):
        l = l.replace("‌", "").strip()
        l = re.sub(r"\s*[।॥]+\s*$", "", l).strip()
        m = SPEAKER_RE.match(l)
        if m and not l[m.end():].strip():
            speaker = norm_speaker(m.group(1))
            speaker_line = i
            continue
        lines.append(l)
    return speaker, speaker_line, lines


def parse_dcs(rec):
    if rec is None:
        return None, []
    lines = []
    speaker = None
    for l in rec["lines"]:
        dv = D.iast_to_deva(l.strip())
        m = SPEAKER_RE.match(dv.replace("श्रीभगवानुवाच", "श्री भगवानुवाच")) if "उवाच" in dv or "ुवाच" in dv else None
        if m and not dv[m.end():].strip():
            speaker = norm_speaker(m.group(1))
            continue
        lines.append(dv)
    return speaker, lines


def joined(lines):
    """join lines with ' ' and return (text, soft_gap_positions)"""
    text, soft = "", set()
    for i, l in enumerate(lines):
        if i:
            soft.add(len(text))
            text += " "
        text += l
    return text, soft


# ------------------------------------------------------------------ alignment
class Aligned:
    def __init__(self, a, b, merge_vowels=True):
        self.a, self.au = D.norm_with_map(a, merge_vowels)
        self.b, self.bu = D.norm_with_map(b, merge_vowels)
        self.sm = difflib.SequenceMatcher(None, self.a, self.b, autojunk=False)
        self.blocks = [blk for blk in self.sm.get_matching_blocks() if blk.size]
        self.ratio = self.sm.ratio()

    def covered_a(self, i1, i2, ctx=2):
        """True if a[i1:i2] (+context) is matched verbatim in b (an insertion
        point at the very start/end must also be the start/end of b)."""
        lo, hi = max(0, i1 - ctx), min(len(self.a), i2 + ctx)
        for blk in self.blocks:
            if blk.a <= lo and hi <= blk.a + blk.size:
                if lo == 0 and i1 == 0 and blk.b + (lo - blk.a) != 0:
                    return False
                if hi == len(self.a) and i2 == len(self.a) and blk.b + (hi - blk.a) != len(self.b):
                    return False
                return True
        return False

    def covered_b(self, j1, j2, ctx=2):
        lo, hi = max(0, j1 - ctx), min(len(self.b), j2 + ctx)
        for blk in self.blocks:
            if blk.b <= lo and hi <= blk.b + blk.size:
                if lo == 0 and j1 == 0 and blk.a + (lo - blk.b) != 0:
                    return False
                if hi == len(self.b) and j2 == len(self.b) and blk.a + (hi - blk.b) != len(self.a):
                    return False
                return True
        return False

    def map_gap(self, g):
        """gap g in a (between a[g-1] and a[g]) -> gap in b, or None"""
        for blk in self.blocks:
            if blk.a < g < blk.a + blk.size:
                return blk.b + (g - blk.a)
        return None


def has_space(text, units, g):
    """Is there a space between normalised unit g-1 and g?"""
    if g <= 0 or g >= len(units):
        return None
    return " " in text[units[g - 1][1]:units[g][0]]


def gap_pos(units, g):
    return units[g - 1][1], units[g][0]


# ------------------------------------------------------------------ voting
def vote_text(key, body, bes, dcs, dcs_ok, log, unresolved):
    """Resolve spelling differences between current body and Besant, using DCS
    as the tie-breaker. Returns corrected body."""
    al = Aligned(body, bes)
    cd = Aligned(body, dcs) if dcs_ok else None
    bd = Aligned(bes, dcs) if dcs_ok else None
    edits = []
    for tag, i1, i2, j1, j2 in al.sm.get_opcodes():
        if tag == "equal":
            continue
        cur_s = body[al.au[i1][0]:al.au[i2 - 1][1]] if i2 > i1 else ""
        bes_s = bes[al.bu[j1][0]:al.bu[j2 - 1][1]] if j2 > j1 else ""
        ctx_c = body[al.au[max(i1 - 3, 0)][0]:al.au[min(i2 + 3, len(al.au)) - 1][1]]
        ctx_b = bes[al.bu[max(j1 - 3, 0)][0]:al.bu[min(j2 + 3, len(al.bu)) - 1][1]]
        ov = TEXT_OVERRIDES.get(key, {}).get(ctx_c) or TEXT_OVERRIDES.get(key, {}).get(cur_s or ("+" + bes_s))
        dcs_cur = cd.covered_a(i1, i2) if cd else False
        dcs_bes = bd.covered_a(j1, j2) if bd else False
        if ov is not None:
            decision, why = ov
        elif dcs_bes and not dcs_cur:
            decision, why = "besant", "Besant 1922 and DCS agree against current"
        elif dcs_cur and not dcs_bes:
            decision, why = "keep", "current agrees with DCS (Besant differs)"
        else:
            decision, why = "keep", "unresolved"
            unresolved.append((key, ctx_c, ctx_b, cur_s, bes_s))
        if decision == "keep":
            continue
        # compute original span in body
        if i2 > i1:
            s0, s1 = al.au[i1][0], al.au[i2 - 1][1]
        else:
            s0 = s1 = al.au[i1 - 1][1] if i1 > 0 else 0
        rep = bes_s if decision == "besant" else decision
        edits.append((s0, s1, rep, why, ctx_c))
    for s0, s1, rep, why, ctx in sorted(edits, reverse=True):
        before = body
        body = body[:s0] + rep + body[s1:]
        w0 = before.rfind(" ", 0, s0) + 1
        w1 = before.find(" ", s1)
        w1 = len(before) if w1 < 0 else w1
        a1 = body.find(" ", s0 + len(rep))
        a1 = len(body) if a1 < 0 else a1
        log.append(("spelling", before[w0:w1], body[w0:a1], why))
    return body


def vote_spacing(key, body, joints, bes, bes_soft, dcs, dcs_soft, dcs_ok, log, single):
    al = Aligned(body, bes)
    cd = Aligned(body, dcs) if dcs_ok else None
    soft_cur = {p for p, k in joints if k == "nl"}
    danda_cur = {p for p, k in joints if k == "danda"}
    ops = []  # (pos, action)
    for g in range(1, len(al.a)):
        cs = has_space(body, al.au, g)
        lo, hi = gap_pos(al.au, g)
        is_soft = any(lo <= p <= hi for p in soft_cur)
        is_danda = any(lo <= p <= hi for p in danda_cur)
        gb = al.map_gap(g)
        bs = None
        if gb is not None:
            blo, bhi = gap_pos(al.bu, gb)
            if not any(blo <= p <= bhi for p in bes_soft):
                bs = has_space(bes, al.bu, gb)
        ds = None
        if cd is not None:
            gd = cd.map_gap(g)
            if gd is not None:
                dlo, dhi = gap_pos(cd.bu, gd)
                if not any(dlo <= p <= dhi for p in dcs_soft):
                    ds = has_space(dcs, cd.bu, gd)
        if is_danda:
            continue
        if is_soft:
            # gita/gita line break: keep a space only if the sources agree
            ref = bs if bs is not None else ds
            if ref is False:
                ops.append((lo, hi, "", "line break inside a word (Besant/DCS write it joined)"))
            continue
        if not cs and bs and ds and D.AVAGRAHA in body[lo:hi]:
            log.append(("variant", body[max(0, lo - 8):hi + 8], None,
                        "kept current avagraha reading; Besant/DCS read a separate word"))
        elif not cs and bs and ds:
            ops.append((lo, hi, " ", "missing space (Besant 1922 and DCS both separate)"))
        elif cs and bs is False and ds is False:
            ops.append((lo, hi, "", "extra space (Besant 1922 and DCS both join)"))
        elif not cs and bs and ds is None:
            single.append((key, body[max(0, lo - 8):hi + 8], "Besant separates, DCS n/a"))
    for lo, hi, rep, why in sorted(ops, reverse=True):
        ctx = body[max(0, lo - 10):hi + 10]
        body = body[:lo] + rep + body[hi:]
        log.append(("spacing", ctx, body[max(0, lo - 10):lo + len(rep) + 10], why))
    return re.sub(" +", " ", body).strip()


# ------------------------------------------------------------------ structure
def half_boundaries(key, body, bes_lines):
    """Return list of half-verse strings for body, using Besant line
    boundaries (mapped onto body) -- body has no dandas now."""
    if key in STRUCTURE_OVERRIDES and "halves" in STRUCTURE_OVERRIDES[key]:
        return STRUCTURE_OVERRIDES[key]["halves"]
    bes, soft = joined(bes_lines)
    al = Aligned(body, bes, merge_vowels=False)
    cuts = []
    for p in sorted(soft):
        # normalised index in bes of first unit after p
        gb = next((k for k, u in enumerate(al.bu) if u[0] >= p), None)
        if gb is None:
            continue
        # map to body
        ga = None
        for blk in al.blocks:
            if blk.b <= gb < blk.b + blk.size:
                ga = blk.a + (gb - blk.b)
        if ga is None:
            raise ValueError("cannot map Besant line break for %s" % (key,))
        cuts.append(al.au[ga][0])
    spans, last = [], 0
    for c in cuts:
        spans.append([last, c])
        last = c
    spans.append([last, len(body)])
    # Besant sometimes prints a trishtubh verse one pada per line: pair them up
    merged = []
    for sp in spans:
        if merged and merged[-1][2] and 10 <= D.count_syllables(body[sp[0]:sp[1]]) <= 13:
            merged[-1] = [merged[-1][0], sp[1], False]
            continue
        n = D.count_syllables(body[sp[0]:sp[1]])
        merged.append([sp[0], sp[1], 10 <= n <= 13])
    return [body[x:y].strip() for x, y, _ in merged]


def split_half(key, hi, half, nl_hint):
    """Split a half-verse into two padas. Returns (p1, p2, mid_word)."""
    ov = STRUCTURE_OVERRIDES.get(key, {}).get("split", {}).get(hi)
    n = D.count_syllables(half)
    if ov is not None:
        cands = [ov]
    elif n <= 18:
        cands = [n // 2] if n % 2 == 0 else [n // 2, n // 2 + 1]
    else:
        cands = [n // 2] if n % 2 == 0 else [n // 2, n // 2 + 1]
        cands += [k for k in (10, 11, 12, 13) if k not in cands and 10 <= n - k <= 13]
    w = D.weights(half)
    best = None
    for k in cands:
        p1, p2, mid = D.split_at_syllable(half, k)
        score = 0
        if not mid:
            score += 2
        if nl_hint is not None and D.count_syllables(half[:nl_hint]) == k:
            score += 3
        if n > 18:
            for seg in (w[:k], w[k:]):
                if len(seg) >= 3 and seg[-3] == "S" and seg[-2] == "L":
                    score += 1
            if k == n // 2 and n % 2 == 0:
                score += 1
        if ov is not None:
            score += 100
        if best is None or score > best[0]:
            best = (score, p1, p2, mid)
    return best[1], best[2], best[3]


def meter_of(counts):
    if all(7 <= c <= 9 for c in counts):
        return "anushtubh"
    if all(c == 11 for c in counts) or (all(10 <= c <= 11 for c in counts)):
        return "trishtubh"
    if all(c == 12 for c in counts):
        return "jagati"
    if all(10 <= c <= 13 for c in counts):
        return "trishtubh-jagati"
    return "irregular"


def build_lines(meter, padas, mids):
    lines = []
    if meter == "anushtubh":
        nhalf = len(padas) // 2
        for h in range(nhalf):
            sep = "" if mids[2 * h] else " "
            end = " ॥" if h == nhalf - 1 else " ।"
            lines.append(padas[2 * h] + sep + padas[2 * h + 1] + end)
    else:
        for i, p in enumerate(padas):
            s = p + ("-" if mids[i] else "")
            if i == len(padas) - 1:
                s += " ॥"
            elif i % 2 == 1:
                s += " ।"
            lines.append(s)
    return lines


def iast_padas(padas):
    return [D.to_iast(p) for p in padas]


# ------------------------------------------------------------------ main
def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    verses = json.load(open(os.path.join(ROOT, "src", "gita-data", "verse.json")))
    besant = {(r["chapter"], r["verse"]): r for r in json.load(open(os.path.join(OS_DIR, "besant-1922-wikisource", "besant_1922.json")))}
    dcs = {(r["chapter"], r["verse_701"]): r for r in json.load(open(os.path.join(OS_DIR, "dcs-conllu", "dcs_gita_verses.json")))}

    out, changes, unresolved, single = [], {}, [], []
    cats = Counter()
    for x in sorted(verses, key=lambda r: r["id"]):
        key = (x["chapter_number"], x["verse_number"])
        kid = "%d.%d" % key
        log = []
        raw = x["text"]
        fixed = apply_typo_rules(raw, log)
        speaker, body, joints, glued = parse_current(fixed)
        bsp, bsp_line, blines = parse_besant(besant[key])
        dsp, dlines = parse_dcs(dcs.get(key))
        if speaker is None and (bsp or dsp):
            sp = bsp or dsp
            log.append(("speaker", None, sp, "speaker missing in current text, present in Besant/DCS"))
            speaker = sp
        if glued:
            log.append(("speaker", None, speaker, "speaker label was glued to the first word"))
        if speaker and bsp and speaker != bsp:
            log.append(("speaker-mismatch", speaker, bsp, "Besant speaker differs"))
        bes, bes_soft = joined(blines)
        dc, dc_soft = joined(dlines)
        dcs_ok = bool(dlines) and Aligned(body, dc).ratio > 0.95
        body = vote_text(kid, body, bes, dc, dcs_ok, log, unresolved)
        body = vote_spacing(kid, body, joints, bes, bes_soft, dc, dc_soft, dcs_ok, log, single)
        # remaining nl joints -> hint for pada splits
        halves = half_boundaries(key, body, blines)
        padas, mids = [], []
        for hi, h in enumerate(halves):
            # hint: position of a gita/gita line break inside this half
            hint = None
            if D.count_syllables(h) > 18:
                # find original nl split by matching the gita/gita line
                for seg in re.split(r"[\n।]+", re.sub(r"\d+\.\d+", "", fixed)):
                    seg = seg.strip()
                    if not seg or SPEAKER_RE.match(seg):
                        continue
                    sn = D.norm(seg)
                    if D.norm(h).startswith(sn) and 0 < len(sn) < len(D.norm(h)):
                        k = D.count_syllables(seg)
                        nu = D.nuclei(h)
                        if 0 < k < len(nu):
                            hint = nu[k - 1] + 1
                        break
            p1, p2, mid = split_half(key, hi, h, hint)
            padas += [p1, p2]
            mids += [mid, False]
        counts = [D.count_syllables(p) for p in padas]
        meter = STRUCTURE_OVERRIDES.get(key, {}).get("meter") or meter_of(counts)
        lines = build_lines(meter, padas, mids)
        ip = iast_padas(padas)
        iast_lines = build_lines(meter, ip, mids)
        iast_lines = [l.replace(" ।", " |").replace(" ॥", " ||") for l in iast_lines]
        speaker_iast = D.to_iast(speaker) if speaker else None
        plain_iast = "".join(q + ("" if mids[i] else " ") for i, q in enumerate(ip)).strip()
        rec = {
            "id": x["id"],
            "chapter": key[0],
            "verse": key[1],
            "speaker": speaker,
            "speaker_iast": speaker_iast,
            "speaker_en": SPEAKER_EN.get(speaker) if speaker else None,
            "speaker_position": SPEAKER_POSITION.get(kid, 0),
            "meter": meter,
            "padas": padas,
            "pada_syllables": counts,
            "split_words": [i for i, m in enumerate(mids) if m],
            "lines": lines,
            "iast_padas": ip,
            "iast_lines": iast_lines,
            "ascii_key": re.sub(r"[^a-z0-9 ]", "", D.fold_ascii(((speaker_iast + " ") if speaker_iast else "") + plain_iast)),
            "ascii_key_compact": re.sub(r"[^a-z0-9]", "", D.fold_ascii(plain_iast)),
            "text_legacy": raw,
            "transliteration_legacy": x["transliteration"],
            "word_meanings_legacy": x["word_meanings"].strip(),
        }
        out.append(rec)
        # compare normalised old/new for the change log
        old_body = parse_current(raw)[1]
        rec_changes = [l for l in log]
        rebuilt = "".join(p + ("" if mids[i] else " ") for i, p in enumerate(padas)).strip()
        if rebuilt != old_body:
            if not any(c[0] in ("spelling", "spacing", "typo") for c in log):
                rec_changes.append(("other", old_body, rebuilt, "re-segmentation changed the text (unexpected)"))
        if rec_changes:
            changes[kid] = (raw, lines, rec_changes)
            for c in rec_changes:
                cats[c[0]] += 1
        else:
            cats["layout-only"] += 1

    json.dump(out, open(os.path.join(OUT_DIR, "verses.json"), "w"), ensure_ascii=False, indent=1)
    write_changes(changes, cats, unresolved, single, out)
    print("verses:", len(out), "changed:", len(changes), dict(cats))
    print("unresolved:", len(unresolved), "single-source spacing:", len(single))
    for u in unresolved:
        print("  UNRESOLVED", u)
    for s in single:
        print("  SINGLE", s)


def write_changes(changes, cats, unresolved, single, out):
    p = os.path.join(ROOT, "scripts", "out", "formatting_changes.md")
    with open(p, "w") as f:
        f.write("# Sloka formatting changes\n\n")
        f.write("Generated by `scripts/build_db/build_verses.py`. Every verse was re-laid-out "
                "(speaker split off, verse number removed, padas detected by syllable count, "
                "`।`/`॥` dandas); this file lists the verses whose *text* changed, plus the "
                "speaker fixes.\n\n")
        f.write("Sources: current = gita/gita `verse.json`; Besant = Wikisource Besant 1922 (PD); "
                "DCS = Digital Corpus of Sanskrit (CC BY 4.0). Rule: a reading is changed only "
                "when Besant and DCS agree against current, or a mechanical typo rule applies, "
                "or a manual override (listed in `scripts/build_db/overrides.py`) applies.\n\n")
        f.write("## Counts\n\n")
        for k, v in sorted(cats.items()):
            f.write("- %s: %d\n" % (k, v))
        meters = Counter(r["meter"] for r in out)
        f.write("\nMeters: %s\n\n" % dict(meters))
        f.write("## Changes\n\n")
        for kid, (raw, lines, cl) in changes.items():
            f.write("### %s\n\n" % kid)
            f.write("Before:\n\n```\n%s\n```\n\nAfter:\n\n```\n%s\n```\n\n" % (raw.strip(), "\n".join(lines)))
            for c in cl:
                cat, a, b, why = c
                if cat == "spelling":
                    f.write("- **spelling**: `%s` -> `%s` (%s)\n" % (a, b, why))
                elif cat == "variant":
                    f.write("- **variant kept**: `%s` (%s)\n" % (a, why))
                elif cat == "spacing":
                    f.write("- **spacing**: `%s` -> `%s` (%s)\n" % (a, b, why))
                elif cat == "typo":
                    f.write("- **typo**: `%s` -> `%s` (%s)\n" % (a, b, why))
                elif cat == "speaker":
                    f.write("- **speaker**: %s (%s)\n" % (b, why))
                else:
                    f.write("- **%s**: `%s` -> `%s` (%s)\n" % (cat, a, b, why))
            f.write("\n")
        if unresolved:
            f.write("## Unresolved readings (current kept)\n\n")
            for u in unresolved:
                f.write("- %s: current `%s` vs Besant `%s`\n" % (u[0], u[1], u[2]))
        if single:
            f.write("\n## Spacing where only Besant was available (current kept)\n\n")
            for s in single:
                f.write("- %s: `%s` (%s)\n" % s)


if __name__ == "__main__":
    main()
