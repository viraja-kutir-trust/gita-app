"""Validate scripts/out/build/texts.json (+ chapters.json) block structure and
typography. Prints violations; exits 1 if any is unexplained.

Explained = the problem already exists in the source in a way a typographic
fix cannot resolve without guessing (e.g. a quotation mark the source never
closes). Those are listed, not hidden.
"""
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
import textfix as TF  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
B = os.path.join(ROOT, "scripts", "out", "build")
MAX_VQ_LINE = 70

CHECKS = [
    ("double danda typed as ।।", re.compile("।।")),
    ("ASCII pipe", re.compile(r"\|")),
    ("ASCII double hyphen", re.compile("--")),
    ("tab/NBSP", re.compile("[\t   ]")),
    ("zero-width outside Indic letters", re.compile("[\u200b\ufeff\u00ad]|(?<![\u0900-\u0dff])[\u200c\u200d]|[\u200c\u200d](?![\u0900-\u0dff])")),
    ("double space", re.compile("  ")),
    ("space before danda/punctuation", re.compile(r" [।॥,;!?](?!\S*⟧)")),
    ("HTML entity/tag", re.compile(r"&(#\d+|[a-z]+);|</?[a-z]+[ >]")),
    ("straight quote", re.compile("[\"']")),
    ("leading verse-number prefix", re.compile(r"^\s*[।॥]*\s*\d{1,2}\.\d{1,3}\s*[।॥]")),
    ("broken conjunct encoding", re.compile(r"[क-ह]्ि|[क-ह]ि्|ृ़")),
    ("doubled vowel sign", re.compile("([ािीुूृेैोौ])\\1")),
    ("missing space after danda", re.compile(r"[।॥](?=[क-हअ-औ])")),
]


# reviewed by hand: (key, check) -> explanation
MANUAL = {
    ((97, 5, "commentary"), "broken conjunct encoding"):
        "source corruption 'अशारीति्ँहित…' (unrecoverable without the printed edition); left as-is",
    ((460, 1, "commentary"), "unbalanced quotes (“0 ”0 ‘4 ’3)"):
        "source never closes the quote ‘इच्छामि त्वां द्रष्टुमहं तथैव। (end of entry); not guessed",
}


def main():
    texts = json.load(open(os.path.join(B, "texts.json")))
    chapters = json.load(open(os.path.join(B, "chapters.json")))
    src = {}
    for f, typ in (("translation.json", "translation"), ("commentary.json", "commentary")):
        for r in json.load(open(os.path.join(ROOT, "src", "gita-data", f))):
            src[(r["verse_id"], r["author_id"], typ)] = r["description"]
    viol = []
    stats = Counter()

    def check_text(key, raw, s, where):
        if unicodedata.normalize("NFC", s) != s:
            viol.append((key, where, "not NFC", None))
        if s != s.strip() or not s.strip():
            viol.append((key, where, "empty or untrimmed", None))
        for name, rx in CHECKS:
            if name == "straight quote" and key[1] == "src-raw":
                continue
            m = rx.search(s)
            if m:
                viol.append((key, where, "%s: …%s…" % (name, s[max(0, m.start() - 15):m.end() + 15]), None))
        if s.count(TF.PRATIKA_OPEN) != s.count(TF.PRATIKA_CLOSE) or re.search("⟦[^⟧]*⟦", s):
            viol.append((key, where, "unbalanced pratika markers", None))
        if "⟦⟧" in s:
            viol.append((key, where, "empty pratika", None))

    def check_quotes(key, joined, odd, where):
        dq_o, dq_c = joined.count("“"), joined.count("”")
        sq_o, sq_c = joined.count("‘"), joined.count("’")
        if dq_o != dq_c or sq_o > sq_c:
            viol.append((key, where, "unbalanced quotes (“%d ”%d ‘%d ’%d)" % (dq_o, dq_c, sq_o, sq_c),
                         "source has unpaired quotation marks" if odd else None))

    for t in texts:
        key = (t["verse_id"], t["author_id"], t["type"])
        raw = src.get(key)
        if not t["blocks"]:
            viol.append((key, "-", "no blocks", None))
        for i, b in enumerate(t["blocks"]):
            stats[b["type"]] += 1
            where = "%s#%d" % (b["type"], i)
            if b["type"] not in ("paragraph", "heading", "verse_quote", "footnote"):
                viol.append((key, where, "unknown block type", None))
            if b["type"] == "verse_quote":
                if not b.get("lines"):
                    viol.append((key, where, "verse_quote without lines", None))
                    continue
                for l in b["lines"]:
                    if len(l) > MAX_VQ_LINE and t["author_id"] != 24:
                        viol.append((key, where, "verse_quote line > %d chars: %s" % (MAX_VQ_LINE, l[:40]), None))
                    check_text(key, None, l.rstrip(" ।॥"), where)
                if t["author_id"] != 24:
                    if not b["lines"][-1].endswith(" ॥"):
                        viol.append((key, where, "verse_quote must end with ' ॥'", None))
                    if len(b["lines"]) not in (2, 4):
                        viol.append((key, where, "verse_quote with %d lines" % len(b["lines"]), None))
            else:
                check_text(key, raw, b["text"], where)
                if b["type"] == "heading" and len(b["text"]) > 40:
                    viol.append((key, where, "heading too long", None))
        joined = " ".join(b.get("text", "") for b in t["blocks"] if b["type"] != "verse_quote")
        check_quotes(key, joined, t.get("src_quote_odd"), "entry")
        if t["lang"] == "sanskrit" and "?" in t["body"]:
            stats["sanskrit '?' left (sentence-final)"] += t["body"].count("?")
    for c in chapters:
        for k, odd in (("summary_en_blocks", "src_quote_odd_en"), ("summary_hi_blocks", "src_quote_odd_hi")):
            for i, b in enumerate(c[k]):
                check_text(("ch%d" % c["number"], "chapters", k), None, b["text"], "%s#%d" % (k, i))
            check_quotes(("ch%d" % c["number"], "chapters", k), " ".join(b["text"] for b in c[k]), c[odd], "entry")

    for i, v in enumerate(viol):
        if not v[3] and (v[0], v[2].split(":")[0]) in MANUAL:
            viol[i] = v[:3] + (MANUAL[(v[0], v[2].split(":")[0])],)
    unexplained = [v for v in viol if not v[3]]
    explained = [v for v in viol if v[3]]
    print("texts: %d, blocks: %s" % (len(texts), dict(stats)))
    by = Counter(re.sub(r":.*", "", v[2]) for v in explained)
    print("explained violations: %d %s" % (len(explained), dict(by)))
    for v in explained[:15]:
        print("  [ok] %s %s %s -- %s" % v)
    if len(explained) > 15:
        print("  … %d more (all: source has unpaired quotation marks)" % (len(explained) - 15))
    print("UNEXPLAINED violations: %d" % len(unexplained))
    byu = Counter(re.sub(r":.*", "", v[2]) for v in unexplained)
    print("  by kind:", dict(byu))
    seen = defaultdict(int)
    for v in unexplained:
        k = re.sub(r":.*", "", v[2])
        seen[k] += 1
        if seen[k] <= 6:
            print("  [!!] %s %s %s" % v[:3])
    return 1 if unexplained else 0


if __name__ == "__main__":
    sys.exit(main())
