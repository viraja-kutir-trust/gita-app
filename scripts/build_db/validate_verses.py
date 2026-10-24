"""Validate scripts/out/build/verses.json: every verse must have a sensible
sloka structure.  Prints outliers; exits 1 if any outlier is unexplained.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import deva as D  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OS_DIR = os.path.join(ROOT, "scripts", "out", "opensource")

SPEAKERS = {None, "धृतराष्ट्र उवाच", "सञ्जय उवाच", "अर्जुन उवाच", "श्रीभगवानुवाच"}
EXPECTED_PADA = {"anushtubh": {8}, "trishtubh": {11}, "jagati": {12}, "trishtubh-jagati": {11, 12}}

# verse -> {check_name: explanation}
EXPLAINED = {
    "11.1": {"syllables": "pada 1 'मदनुग्रहाय परमं' has 9 syllables in all editions (hypermetric anushtubh pada)"},
    "1.25": {"uvaca-in-text": "'उवाच पार्थ पश्यैतान्...' is Sanjaya's narration inside the verse, not a speaker label"},
    "1.44": {"besant": "variant नरकेऽनियतं (current, Gita Press) vs नरके नियतं (Besant, critical ed.)"},
    "2.3": {"besant": "Besant typos क्लैव्यं / उत्तिष्ट; current क्लैब्यं / उत्तिष्ठ kept"},
    "2.9": {"besant": "vocative परन्तप kept; Besant परन्तपः"},
    "2.26": {"besant": "variant नैवं (Gita Press) kept; Besant/DCS नैनं", "dcs": "same variant नैवं / नैनं"},
    "3.8": {"besant": "orthographic variant प्रसिद्ध्येत् kept; Besant/DCS प्रसिध्येत्", "dcs": "same"},
    "12.18": {"besant": "Besant typo मानपमानयोः; current मानापमानयोः kept"},
    "18.68": {"besant": "variant य इमं (Gita Press) kept; Besant/DCS य इदं", "dcs": "same variant"},
    "17.23": {"besant": "ॐ vs Besant's spelling ओं (same syllable)", "dcs": "ॐ vs DCS oṃ (same syllable)"},
    "2.6": {"besant": "Besant prints ':' (visarga) in जिजीविषाम: ते; correct sandhi जिजीविषामस्ते"},
}

IAST_OK = re.compile(r"^[a-zāīūṛṝḷḹṃḥṅñṭḍṇśṣ' \-|]+$")
BAD_DEVA = [
    (re.compile(r"[क-ह]्ि"), "i-matra after virama"),
    (re.compile(r"[क-ह]ि्"), "virama after i-matra"),
    (re.compile("ृ़"), "ṛ + nukta"),
    (re.compile("([ािीुूृेैोौ])\\1"), "doubled matra"),
    (re.compile("[ािीुूृेैोौंः][ािीुूृेैोौ]"), "two vowel signs"),
    (re.compile("श्रृ"), "श्रृ"),
    (re.compile("[a-zA-Z0-9०-९|:.]"), "latin/digit/ascii punctuation"),
    (re.compile("  "), "double space"),
    (re.compile("।।"), "ASCII double danda"),
    (re.compile("[ऀ-ॿ]़"), "nukta (not used in Sanskrit)"),
]


def main():
    verses = json.load(open(os.path.join(ROOT, "scripts", "out", "build", "verses.json")))
    besant = {(r["chapter"], r["verse"]): r for r in json.load(open(os.path.join(OS_DIR, "besant-1922-wikisource", "besant_1922.json")))}
    dcs = {(r["chapter"], r["verse_701"]): r for r in json.load(open(os.path.join(OS_DIR, "dcs-conllu", "dcs_gita_verses.json")))}
    chapters = json.load(open(os.path.join(ROOT, "src", "gita-data", "chapters.json")))
    outliers = []

    def bad(kid, check, msg):
        outliers.append((kid, check, msg, EXPLAINED.get(kid, {}).get(check)))

    if len(verses) != 701:
        bad("all", "count", "expected 701 verses, got %d" % len(verses))
    per_ch = {}
    for r in verses:
        per_ch[r["chapter"]] = per_ch.get(r["chapter"], 0) + 1
    for c in chapters:
        if per_ch.get(c["chapter_number"]) != c["verses_count"]:
            bad("ch%d" % c["chapter_number"], "count", "verse count mismatch")

    import difflib
    for r in verses:
        kid = "%d.%d" % (r["chapter"], r["verse"])
        padas, lines, meter = r["padas"], r["lines"], r["meter"]
        if r["speaker"] not in SPEAKERS:
            bad(kid, "speaker", r["speaker"])
        if len(padas) not in (4, 6):
            bad(kid, "padas", "%d padas" % len(padas))
        if meter not in EXPECTED_PADA:
            bad(kid, "meter", meter)
        else:
            counts = [D.count_syllables(p) for p in padas]
            if any(c not in EXPECTED_PADA[meter] for c in counts):
                bad(kid, "syllables", "%s %s" % (meter, counts))
        exp_lines = len(padas) // 2 if meter == "anushtubh" else len(padas)
        if len(lines) != exp_lines:
            bad(kid, "lines", "%d lines for %s" % (len(lines), meter))
        for i, l in enumerate(lines):
            last = i == len(lines) - 1
            if last and not l.endswith(" ॥"):
                bad(kid, "danda", "last line must end with ' ॥': " + l)
            if meter == "anushtubh" and not last and not l.endswith(" ।"):
                bad(kid, "danda", "anushtubh line must end with ' ।': " + l)
            if meter != "anushtubh" and not last:
                want = " ।" if i % 2 == 1 else ""
                if want and not l.endswith(want):
                    bad(kid, "danda", "line %d should end with ।: %s" % (i, l))
                if not want and (l.endswith("।") or l.endswith("॥")):
                    bad(kid, "danda", "line %d should have no danda: %s" % (i, l))
            if l.endswith("-") != (meter != "anushtubh" and i in r["split_words"]):
                bad(kid, "hyphen", l)
        for p in padas:
            for rx, what in BAD_DEVA:
                if rx.search(p):
                    bad(kid, "encoding", "%s in '%s'" % (what, p))
            if "\n" in p or "।" in p or "॥" in p:
                bad(kid, "padas", "danda/newline in pada " + p)
            if p != p.strip() or not p:
                bad(kid, "padas", "untrimmed/empty pada")
        if re.search("उवाच", " ".join(padas)):
            bad(kid, "uvaca-in-text", " ".join(padas)[:60])
        # IAST
        if len(r["iast_lines"]) != len(lines):
            bad(kid, "iast", "line count")
        for ip, p in zip(r["iast_padas"], padas):
            if not IAST_OK.match(ip):
                bad(kid, "iast", "unexpected chars in " + ip)
            if D.norm(D.iast_to_deva(ip)) != D.norm(p):
                bad(kid, "iast", "round-trip mismatch " + ip)
        if not re.fullmatch(r"[a-z0-9 ]+", r["ascii_key"]):
            bad(kid, "ascii", r["ascii_key"][:40])
        # cross-checks
        key = (r["chapter"], r["verse"])
        body = D.norm(" ".join(padas))
        # Cross-check: a reading of ours that differs from Besant is an outlier
        # only if DCS does not support it either (2-of-3 majority rule).
        bl = [re.sub(r"\s*[।॥]\s*$", "", l) for l in besant[key]["sanskrit_lines"]
              if not re.search("उवाच\\s*।?$|ुवाच\\s*।?$", l)]
        bn = D.norm(" ".join(bl))
        dn = None
        if key in dcs:
            dl = [D.iast_to_deva(l) for l in dcs[key]["lines"]]
            dl = [l for l in dl if not re.search("उवाच$|ुवाच$", l.strip())]
            dn = D.norm(" ".join(dl))
            if difflib.SequenceMatcher(None, body, dn, autojunk=False).ratio() < 0.95:
                dn = None  # unsandhied treebank lines (ch.1-2): not comparable
        if bn != body:
            sm = difflib.SequenceMatcher(None, body, bn, autojunk=False)
            for t, i1, i2, j1, j2 in sm.get_opcodes():
                if t == "equal":
                    continue
                ours = body[max(0, i1 - 3):i2 + 3]
                if dn is not None and ours in dn:
                    STATS["besant_only"] += 1
                    continue
                bad(kid, "besant", "ours %r vs Besant %r%s" % (body[i1:i2], bn[j1:j2],
                    "" if dn is not None else " (DCS n/a)"))
        if dn is not None and dn != body:
            STATS["dcs_diff_verses"] += 1

    unexplained = [o for o in outliers if not o[3]]
    explained = [o for o in outliers if o[3]]
    print("verses checked: %d" % len(verses))
    print("explained outliers: %d" % len(explained))
    for o in explained:
        print("  [ok] %s %-14s %s  -- %s" % o)
    print("info: %d Besant-only differences where DCS supports our reading (Besant typos); "
          "%d verses differ from DCS somewhere (DCS sandhi/orthography; Besant supports ours)"
          % (STATS["besant_only"], STATS["dcs_diff_verses"]))
    print("UNEXPLAINED outliers: %d" % len(unexplained))
    for o in unexplained:
        print("  [!!] %s %-14s %s" % o[:3])
    return 1 if unexplained else 0


STATS = {"besant_only": 0, "dcs_diff_verses": 0}

if __name__ == "__main__":
    sys.exit(main())
