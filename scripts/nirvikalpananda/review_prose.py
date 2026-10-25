"""List Telugu words of the meanings, translations and footnotes that may be misread.

  scripts/.venv/bin/python scripts/nirvikalpananda/review_prose.py

There is no second copy of the Telugu text, so suspicious words are found two ways
and then judged by hand, in context (fixes go to prose_fixes.tsv):

  A. the archive.org OCR read a different word at the same place on the page, that
     word is common in the book and ours is rare;
  B. our word is rare and one letter away from a common word of the book.

Writes dataset/prose_candidates.tsv: kind, our word, other word, counts, context.
"""
import collections
import json
import os
import re

from anu import DecodeError, decode
from anu_glyphs import aksharas
from learn_map import hocr_pages, overlap, pdf_words
from lines import load_pages

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(HERE, "dataset", "nirvikalpananda.json")
CACHE = os.path.join(ROOT, "scripts", "out", "nirvikalpananda", "_cache")
OUT = os.path.join(HERE, "dataset", "prose_candidates.tsv")
TE_WORD = re.compile(r"[ఀ-౿‌]+")


def prose_texts(d):
    for uid, u in d["units"].items():
        for w in u["words"]:
            yield uid, w["meaning"]
        for p in u.get("preface", []) + u["translation"]:
            yield uid, p
        for f in u["footnotes"]:
            yield uid, f["text"]
    for ch, c in d["chapters"].items():
        for f in c.get("intro_footnotes", []) + c.get("colophon_footnotes", []):
            yield f"ch{ch}", f["text"]


def words_of(t):
    return TE_WORD.findall(re.sub(r"⁽\d+⁾", "", t))


def one_akshara_apart(a, b):
    x, y = aksharas(a), aksharas(b)
    if len(x) != len(y) or x == y:
        return False
    return sum(1 for p, q in zip(x, y) if p != q) == 1


def main():
    d = json.load(open(DATA))
    freq = collections.Counter()
    ctx = {}
    for uid, t in prose_texts(d):
        for m in TE_WORD.finditer(re.sub(r"⁽\d+⁾", "", t)):
            w = m.group(0)
            freq[w] += 1
            if w not in ctx:
                ctx[w] = (uid, t[max(0, m.start() - 40): m.end() + 40].replace("\n", " "))
    rows = []
    # A. OCR at the same place
    seen = set()
    for ch in range(1, 19):
        pages = load_pages(ch)
        hocr = hocr_pages(os.path.join(CACHE, "src", f"ch{ch:02d}_hocr.html"))
        for pno, page in enumerate(pages):
            ows = hocr[pno] if pno < len(hocr) else []
            for w in pdf_words(page):
                if not w[4].strip():
                    continue
                try:
                    ours = words_of(decode(w[4]))
                except DecodeError:
                    continue
                best, bo = None, 0.5
                for o in ows:
                    v = overlap(w, o)
                    if v > bo:
                        best, bo = o, v
                if not best or len(ours) != 1:
                    continue
                ocr = words_of(best[4].replace("‌", ""))
                if len(ocr) != 1:
                    continue
                a, b = ours[0], ocr[0]
                if a == b or (a, b) in seen:
                    continue
                if freq[a] <= 2 and freq[b] >= 3:
                    seen.add((a, b))
                    rows.append(("ocr", a, b, freq[a], freq[b], *ctx.get(a, ("", ""))))
    # B. one letter from a common word
    common = [w for w, n in freq.items() if n >= 5 and len(aksharas(w)) >= 3]
    by_len = collections.defaultdict(list)
    for w in common:
        by_len[len(aksharas(w))].append(w)
    for w, n in freq.items():
        if n > 1 or len(aksharas(w)) < 3:
            continue
        near = [c for c in by_len[len(aksharas(w))] if one_akshara_apart(w, c)]
        if near:
            best = max(near, key=freq.get)
            rows.append(("near", w, best, n, freq[best], *ctx.get(w, ("", ""))))
    with open(OUT, "w") as f:
        for r in rows:
            f.write("\t".join(str(x) for x in r) + "\n")
    print(len(rows), "candidates:", collections.Counter(r[0] for r in rows))


if __name__ == "__main__":
    main()
