"""Harden the parsed dataset against the Sanskrit of gita.db (the blueprint).

  scripts/.venv/bin/python scripts/nirvikalpananda/harden.py

Runs after parse.py and rewrites dataset/nirvikalpananda.json in place:

1. Sloka lines: each printed line is replaced by the gita.db line of the same verse,
   in Telugu script. The book's line is kept as `book_lines`; every word that
   differed is logged.
2. Padaccheda and the Sanskrit terms of the word-by-word list: each word is checked
   against the (corrected) sloka. A word whose stem is not in the verse is replaced
   by the verse's form of that word when the match is unambiguous (sandhi-variable
   endings are kept from the book, the stem comes from the verse).
3. Telugu prose: fixes reviewed by hand in prose_fixes.tsv (see review_prose.py).

Every change is written to dataset/corrections.md.
"""
import difflib
import json
import os
import re
import sys

from indic_transliteration import sanscript

from align import INDEP_TO_MATRA, db_chapter, norm_dev, te2dev

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "dataset", "nirvikalpananda.json")
LOG = os.path.join(HERE, "dataset", "corrections.md")
PROSE = os.path.join(HERE, "prose_fixes.tsv")
TERM_FIXES = os.path.join(HERE, "term_fixes.tsv")
MARK = re.compile(r"⁽\d+⁾")


def dev2te(s):
    return sanscript.transliterate(s, sanscript.DEVANAGARI, sanscript.TELUGU)


def words(s):
    return [w for w in re.split(r"[\s,]+", MARK.sub("", s)) if w and not re.fullmatch(r"[।॥.\-–]+", w)]


# ---------------------------------------------------------------- 1. slokas
def fix_slokas(d, log):
    db = {}
    for ch in range(1, 19):
        for v in db_chapter(ch):
            db[(ch, v["verse"])] = v
    seen = {}
    for uid, u in d["units"].items():
        ch = u["chapter"]
        for b in u["blocks"]:
            b["book_lines"] = list(b["lines"])
            new = []
            for line, vv in zip(b["lines"], b["verses"]):
                k = seen.get((ch, vv), 0)
                seen[(ch, vv)] = k + 1
                ref = db[(ch, vv)]["lines"][k]
                ref_te = dev2te(ref)  # gita.db's line, with its own dandas and pada hyphens
                notes = "".join(MARK.findall(line))
                if notes:
                    m = re.search(r"\s*[।॥]\s*$", ref_te)
                    ref_te = ref_te[: m.start()] + " " + notes + ref_te[m.start():] if m else ref_te + " " + notes
                new.append(ref_te)
                bw, rw = words(line), words(ref_te)
                a = [norm_dev(te2dev(w)) for w in bw]
                c = [norm_dev(te2dev(w)) for w in rw]
                sm = difflib.SequenceMatcher(None, a, c, autojunk=False)
                for op, i1, i2, j1, j2 in sm.get_opcodes():
                    if op == "equal":
                        continue
                    x, y = " ".join(bw[i1:i2]), " ".join(rw[j1:j2])
                    if norm_dev(te2dev(x.replace(" ", ""))) == norm_dev(te2dev(y.replace(" ", ""))):
                        kind = "split/join"
                    else:
                        kind = "reading"
                    log.append(("sloka", f"{ch}.{vv}", x, y, kind))
            b["lines"] = new


# ---------------------------------------------------------------- 2. padaccheda / terms
VOWEL_START = "అఆఇఈఉఊఋఎఏఐఒఓఔ"


def keyform(w):
    """Comparison form of one word: Devanagari, nasals as anusvara, no punctuation."""
    return norm_dev(te2dev(w.replace("–", "").replace("-", "")).replace("ॐ", "ओं"))


def stem(k):
    """Drop what sandhi may change at the end of a word: a dead consonant (त्, न्, म्),
    visarga or anusvara, then a final vowel sign (सर्वे → सर्व, समाधौ → समाध)."""
    if re.search(r"[क-ह]्$", k):
        return k[:-2]          # इमान् → इमा: the vowel before a final consonant must match
    if re.search(r"[ःं]$", k):
        return k[:-1]          # पुत्राः → पुत्रा
    return re.sub(r"[ािीुूृेैोौ]$", "", k)  # सर्वे → सर्व (सर्व एव)


def loose(k):
    """Sandhi-blind key: nasals before consonants (ं, न्, म् …), visarga and virama
    dropped; a nasal with a vowel (नि in निनद्य) stays, so a wrong letter still shows."""
    k = re.sub(r"[ङञणनम]्", "", k)
    return re.sub(r"[ंःँ्]", "", k)


def found(w, hay, hay_loose, start=None):
    """Is word w (Telugu) in the verse, allowing for what sandhi changes?
    With `start`, the word must occur soon after that position (padaccheda follows
    the verse order); returns the position after the match, or None."""
    k = keyform(w)
    s = stem(k)
    if len(s) < 2:
        return True if start is None else start  # too short to check (च, न, हि)
    cands = [s]
    if w[0] in VOWEL_START and s[:1] in INDEP_TO_MATRA:
        # merged with the previous word: आत्मनि in स्यात्मन्यथो, अपि in चापि, इति in त्विति
        cands += [INDEP_TO_MATRA[s[0]] + s[1:], s[1:]]
        cands += [m + s[1:] for m in "ाेो" if s[0] in "अआइईउऊ"]
    if s.startswith("श"):
        cands.append("छ" + s[1:])  # त् + श → च्छ
    # -नि/-णि/-मि before a vowel becomes न्य/ण्य/म्य, which the comparison form writes ंय
    cands += [c[:-1] + "ं" for c in cands if c[-1:] in ("न", "ण", "म")]
    if start is not None:
        win = hay[max(0, start - 4): start + len(s) + 14]
        hits = [(win.find(c), c) for c in cands if c and len(re.findall(r"[क-ह]", c)) >= 1 and win.find(c) >= 0]
        if hits:
            i, c = min(hits)
            return max(0, start - 4) + i + len(c)
        wl = loose(win)
        for c in cands:
            lc = loose(c)
            if len(re.findall(r"[क-ह]", lc)) >= 2 and lc in wl:
                return start + len(c)
        return None
    if any(c and c in hay for c in cands):
        return True
    lc = [loose(c) for c in cands]
    # the loose key must keep at least two consonants, or anything would match
    return any(len(re.findall(r"[क-ह]", c)) >= 2 and c in hay_loose for c in lc)


def skip(w, at):
    """After an unmatched word, step over roughly its length so the next word is in reach."""
    return at + max(1, len(stem(keyform(w))) - 1)


def nearest(w, hay):
    s = stem(keyform(w))
    best = (0, "")
    for L in (len(s) - 1, len(s), len(s) + 1):
        for i in range(0, max(0, len(hay) - L) + 1):
            sub = hay[i:i + L]
            r = difflib.SequenceMatcher(None, s, sub, autojunk=False).ratio()
            if r > best[0]:
                best = (r, sub)
    return best


def split_word(w, vocab):
    """Split a run-together term into words of the passage: 'సర్వేచ' → 'సర్వే చ'."""
    keys = {}
    for v in vocab:
        for f in {v, re.sub("ం$", "మ్", v), re.sub("మ్$", "ం", v)}:
            keys[keyform(f)] = v
    k = keyform(w)
    best = {0: []}
    for i in range(len(k)):
        if i not in best:
            continue
        for j in range(i + 1, len(k) + 1):
            if k[i:j] in keys and (j not in best or len(best[j]) > len(best[i]) + 1):
                best[j] = best[i] + [k[i:j]]
    parts = best.get(len(k))
    if parts and len(parts) > 1:
        return [keys[p] for p in parts]
    return None


def fix_wordlists(d, log, manual):
    db = {}
    for ch in range(1, 19):
        for v in db_chapter(ch):
            db[(ch, v["verse"])] = v
    for uid, u in d["units"].items():
        ch = u["chapter"]
        text = " ".join(l for b in u["blocks"] for l in b["lines"])
        speakers = " ".join(dev2te(db[(ch, v)]["speaker"] or "") for v in u["verses"])
        hay = norm_dev(te2dev(text + " " + speakers)).replace(" ", "")
        ctx = (hay, loose(hay))
        vocab = set()
        for b in u["blocks"]:
            vocab |= {w for t in b["padaccheda"].split(",") for w in t.split()}
        for b in u["blocks"]:
            bhay = norm_dev(te2dev(" ".join(b["lines"]))).replace(" ", "")
            pos = [0]
            toks = [t.strip() for t in b["padaccheda"].split(",")]
            out = []
            for t in toks:
                if (uid, "padtoken", t) in manual:  # a whole comma-separated token, reviewed
                    new = manual[(uid, "padtoken", t)]
                    log.append(("padaccheda", uid, t, new, "reviewed"))
                    pos[0] = advance(new, (bhay, loose(bhay)), pos[0])
                    out.append(new)
                    continue
                out.append(" ".join(apply_word(w, uid, "padaccheda", (bhay, loose(bhay)), log, manual, None, pos) for w in t.split()))
            b["padaccheda"] = ", ".join(out)
        for wd in u["words"]:
            if wd.get("implied"):
                continue
            wd["term"] = " ".join(apply_word(w, uid, "term", ctx, log, manual, vocab) for w in wd["term"].split())
        # Terms must be words of the (now verified) padaccheda or the speaker label, or
        # members of a compound the padaccheda writes whole.
        check_terms(uid, u, speakers, vocab, log, manual)


OCCUR = {}


SPEAKER_WORDS = {"ఉవాచ", "శ్రీభగవాన్", "భగవాన్", "అర్జునః", "సంజయః", "సఞ్జయః", "ధృతరాష్ట్రః"}


def check_terms(uid, u, speakers, vocab, log, manual):
    verse_key = norm_dev(te2dev(" ".join(l for b in u["blocks"] for l in b["lines"]))).replace(" ", "")
    toks = [t.strip() for b in u["blocks"] for t in b["padaccheda"].split(",") if t.strip()]
    whole = {keyform(t.replace(" ", "")) for t in toks} | {keyform(p) for t in toks for p in re.split(r"[\s–-]+", t) if p}
    whole |= {keyform(w) for w in SPEAKER_WORDS}
    for wd in u["words"]:
        if wd.get("implied"):
            continue
        out = []
        for w in wd["term"].split():
            core = MARK.sub("", w)
            parts = [p for p in re.split(r"[–-]", core) if p]
            if not parts or "(" in w or ")" in w or all(term_ok(p, whole) for p in parts) or keyform(core) in verse_key:
                # (or a sandhi phrase exactly as the verse has it: శ్రుత్వాపి, నరాణాంచ)
                out.append(w)
                continue
            key = (uid, "term", w)
            if key in manual or (uid, "*", w) in manual:
                out.append(w)
                continue
            sp = split_word(core, vocab | SPEAKER_WORDS)
            if sp and all(term_ok(p, whole) for p in sp):
                new = " ".join(sp) + "".join(MARK.findall(w))
                log.append(("term", uid, w, new, "split"))
                out.append(new)
                continue
            TERM_VS_PAD.append((uid, w, wd["term"], ""))
            out.append(w)
        wd["term"] = " ".join(out)


def term_ok(w, whole):
    k = keyform(w)
    if k in whole or len(stem(k)) < 2:
        return True
    # a compound member: inside a clearly longer padaccheda word, with vowel sandhi
    s = stem(k)
    cands = [s]
    if s[:1] in INDEP_TO_MATRA:  # vowel sandhi with the member before it: महा+इष्वासाः = महेष्वासाः
        cands += [m + s[1:] for m in {INDEP_TO_MATRA[s[0]], "ा", "े", "ो", "ै", "ौ"}]
    cands += [c[:-1] + "ं" for c in cands if c[-1:] in ("न", "ण", "म")]
    return any(c and c in pk and len(pk) >= len(k) + 2 for pk in whole for c in cands)


def apply_word(w, uid, field, ctx, log, manual, vocab, pos=None):
    n = OCCUR[(uid, field, w)] = OCCUR.get((uid, field, w), 0) + 1
    for key in ((uid, field, f"{w}#{n}"), (uid, "*", f"{w}#{n}"), (uid, field, w), (uid, "*", w)):
        if key in manual:
            new = manual[key]
            if new != w:
                log.append((field, uid, w, new, "reviewed"))
            if pos is not None:
                pos[0] = advance(new, ctx, pos[0])
            return new
    core = MARK.sub("", w).strip("()")
    if not core or "(" in w or ")" in w or not re.search(r"[\u0c00-\u0c7f]", core):
        return w
    parts = [p for p in re.split(r"[–-]", core) if p]
    if pos is not None:
        at = pos[0]
        for p in parts:
            nxt = found(p, ctx[0], ctx[1], at)
            if nxt is None:
                UNMATCHED.append((uid, field, w, nearest(core, ctx[0][max(0, at - 4):at + 30] or ctx[0])))
                pos[0] = skip(core, at)
                return w
            at = nxt
        pos[0] = at
        return w
    if all(found(p, *ctx) for p in parts):
        return w
    if vocab:
        sp = split_word(core, vocab)
        if sp and all(found(p, *ctx) for p in sp):
            new = " ".join(sp) + "".join(MARK.findall(w))
            log.append((field, uid, w, new, "split"))
            return new
    UNMATCHED.append((uid, field, w, nearest(core, ctx[0])))
    return w


UNMATCHED = []
TERM_VS_PAD = []


def advance(w, ctx, at):
    for p in re.split(r"[\s–-]+", MARK.sub("", w)):
        if p:
            nxt = found(p, ctx[0], ctx[1], at)
            at = nxt if nxt is not None else at
    return at


# ---------------------------------------------------------------- 3. prose
def fix_prose(d, log, rules):
    """rules: [(unit or '*', field, wrong, right)] applied as whole-word replacements."""
    def sub(text, wrong, right):
        return re.sub(rf"(?<![ఀ-౿]){re.escape(wrong)}(?![ఀ-౿])", right, text)

    for uid, u in d["units"].items():
        for scope, field, wrong, right in rules:
            if scope not in ("*", uid):
                continue
            for wd in u["words"]:
                if field in ("*", "meaning") and wrong in wd["meaning"]:
                    nw = sub(wd["meaning"], wrong, right)
                    if nw != wd["meaning"]:
                        log.append(("meaning", uid, wrong, right, "reviewed"))
                        wd["meaning"] = nw
            for key in ("translation", "preface"):
                if field in ("*", "translation"):
                    for i, p in enumerate(u.get(key, [])):
                        np = sub(p, wrong, right)
                        if np != p:
                            log.append((key, uid, wrong, right, "reviewed"))
                            u[key][i] = np
            if field in ("*", "footnote"):
                for f in u["footnotes"]:
                    nf = sub(f["text"], wrong, right)
                    if nf != f["text"]:
                        log.append(("footnote", uid, wrong, right, "reviewed"))
                        f["text"] = nf


def load_tsv(path):
    rows = []
    if not os.path.exists(path):
        return rows
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line or line.startswith("#"):
            continue
        rows.append(tuple(x.strip() for x in line.split("\t")))
    return rows


def main():
    d = json.load(open(DATA))
    if d.get("hardened"):
        sys.exit("dataset already hardened; run parse.py first")
    log = []
    fix_slokas(d, log)
    manual = {}
    for row in load_tsv(TERM_FIXES):
        uid, field, wrong, right = row[:4]
        manual[(uid, field, wrong)] = right
    fix_wordlists(d, log, manual)
    fix_prose(d, log, [r[:4] for r in load_tsv(PROSE)])
    d["hardened"] = True
    json.dump(d, open(DATA, "w"), ensure_ascii=False, indent=1)
    with open(LOG, "w") as f:
        f.write("# Corrections applied by harden.py\n\nfield | unit/verse | book | corrected | why\n---|---|---|---|---\n")
        for r in log:
            f.write(" | ".join(r) + "\n")
    with open(os.path.join(HERE, "dataset", "unmatched_words.tsv"), "w") as f:
        for uid, field, w, best in UNMATCHED:
            f.write(f"{uid}\t{field}\t{w}\t{te2dev(w)}\t{best[1]}\t{best[0]:.2f}\n")
    with open(os.path.join(HERE, "dataset", "terms_not_in_padaccheda.tsv"), "w") as f:
        for uid, w, term, _ in TERM_VS_PAD:
            f.write(f"{uid}\t{w}\t{term}\n")
    print(f"{len(log)} corrections, {len(UNMATCHED)} words not found in their verse, {len(TERM_VS_PAD)} term words not in the padaccheda", file=sys.stderr)


if __name__ == "__main__":
    main()
