"""Check the decoded Sanskrit against gita.db and the dataset's shape.

  scripts/.venv/bin/python scripts/nirvikalpananda/validate.py [--all]

For every verse the book's sloka lines (Telugu) are transliterated to Devanagari and
compared with gita.db after normDeva-style normalisation. Differences are printed as
character-level diffs; each was reviewed against the scan (see REVIEW.md).
"""
import difflib
import json
import os
import re
import sys

from align import db_chapter, norm_dev, te2dev

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(HERE, "dataset", "nirvikalpananda.json")
TELUGU = re.compile(r"^[ఀ-౿\s‌‍।॥ఽ⁽⁾0-9.,;:!?()\[\]‘’'\"“”=+–—\-/*]*$")


def diff(a, b):
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    out = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op != "equal":
            out.append(f"{a[max(0, i1 - 3):i2 + 3]!s} → {b[max(0, j1 - 3):j2 + 3]!s}")
    return "; ".join(out)


def main(show_all=False):
    d = json.load(open(DATA))
    units = d["units"]
    bad = 0
    total = 0
    for ch in range(1, 19):
        for v in db_chapter(ch):
            key = f"{ch}.{v['verse']}"
            total += 1
            lines = []
            for uid in d["verses"].get(key, {}).get("units", []):
                for b in units[uid]["blocks"]:
                    lines += [t for t, vv in zip(b["lines"], b["verses"]) if vv == v["verse"]]
            book = norm_dev(te2dev(" ".join(lines)))
            ref = norm_dev(" ".join(v["lines"]))
            r = difflib.SequenceMatcher(None, book, ref, autojunk=False).ratio()
            if book != ref:
                bad += 1
                if show_all or r < 0.995:
                    print(f"{key}\t{r:.3f}\t{diff(book, ref)}")
    print(f"{bad}/{total} verses differ from gita.db after normalisation", file=sys.stderr)
    # character inventory: anything outside Telugu + expected punctuation
    odd = {}
    for uid, u in units.items():
        texts = [l for b in u["blocks"] for l in b["lines"]] + [b["padaccheda"] for b in u["blocks"]]
        texts += [w["term"] for w in u["words"]] + [w["meaning"] for w in u["words"]] + u["translation"] + [f["text"] for f in u["footnotes"]]
        for t in texts:
            for c in t:
                if not TELUGU.match(c) and not c.isspace():
                    odd.setdefault(c, uid)
    print("unexpected characters:", {c: u for c, u in odd.items()}, file=sys.stderr)


if __name__ == "__main__":
    main("--all" in sys.argv)
