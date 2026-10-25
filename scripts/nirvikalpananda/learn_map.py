"""Learn glyph-cluster -> Telugu akshara statistics by pairing each PDF word with the
archive.org OCR word at the same position (hOCR boxes). The OCR is noisy; a majority
vote over thousands of occurrences gives the reading of each glyph cluster.

Writes scripts/out/nirvikalpananda/_cache/cluster_votes.json
"""
import collections
import glob
import html
import json
import os
import re

from anu_glyphs import aksharas, clusters

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(ROOT, "scripts", "out", "nirvikalpananda", "_cache")
SCALE = 1654 / 396.85
SKIP_FONTS = ("Times", "Ding", "Zapf", "TeluguNumbers")

WORD_RE = re.compile(r"<span class=['\"]ocrx_word['\"][^>]*title=['\"]bbox (\d+) (\d+) (\d+) (\d+);[^>]*>([^<]*)</span>")


def hocr_pages(path):
    text = open(path, encoding="utf-8").read()
    pages = re.split(r"class=['\"]ocr_page['\"]", text)[1:]
    out = []
    for p in pages:
        out.append([(int(a) / SCALE, int(b) / SCALE, int(c) / SCALE, int(d) / SCALE, html.unescape(w)) for a, b, c, d, w in WORD_RE.findall(p)])
    return out


def pdf_words(spans):
    for s in spans:
        if s["font"].startswith(SKIP_FONTS):
            continue
        t, cx = s["text"], s["cx"]
        i = 0
        while i < len(t):
            if t[i] == " ":
                i += 1
                continue
            j = i
            while j < len(t) and t[j] != " ":
                j += 1
            yield (cx[i], s["y0"], cx[j], s["y1"], t[i:j])
            i = j


def overlap(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0


def main():
    votes = collections.defaultdict(collections.Counter)
    examples = collections.defaultdict(list)
    pairs = used = 0
    for ch in range(1, 19):
        spans = json.load(open(os.path.join(CACHE, "spans", f"ch{ch:02d}.json")))
        hocr = hocr_pages(os.path.join(CACHE, "src", f"ch{ch:02d}_hocr.html"))
        for pno, page in enumerate(spans):
            ows = hocr[pno] if pno < len(hocr) else []
            for w in pdf_words(page):
                best, bo = None, 0.45
                for o in ows:
                    v = overlap(w, o)
                    if v > bo:
                        best, bo = o, v
                if not best:
                    continue
                pairs += 1
                gc = clusters(w[4])
                ak = aksharas(best[4])
                if not gc or len(gc) != len(ak):
                    continue
                used += 1
                for g, a in zip(gc, ak):
                    votes[g][a] += 1
                    if len(examples[g]) < 3:
                        examples[g].append(f"{w[4]} = {best[4]}")
    print("pairs", pairs, "used", used, "clusters", len(votes))
    out = {g: {"n": sum(c.values()), "votes": c.most_common(5), "ex": examples[g]} for g, c in votes.items()}
    json.dump(out, open(os.path.join(CACHE, "cluster_votes.json"), "w"), ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
