"""Dump every glyph span of the Nirvikalpananda chapter PDFs to JSON.

  scripts/.venv/bin/python scripts/nirvikalpananda/extract.py

Output: scripts/out/nirvikalpananda/_cache/spans/chNN.json — a list of pages, each a
list of spans {font, size, flags, sup, x0, y0, x1, y1, oy, text, cx} where cx holds
each glyph's x0 (needed to split a span into words with their own boxes).
"""
import json
import os
import sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(ROOT, "scripts", "out", "nirvikalpananda", "_cache")


def spans_of(page):
    out = []
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                chars = s["chars"]
                if not chars:
                    continue
                out.append({
                    "font": s["font"].split("+")[-1],
                    "size": round(s["size"], 2),
                    "flags": s["flags"],
                    "sup": bool(s["flags"] & 1),
                    "x0": round(s["bbox"][0], 2), "y0": round(s["bbox"][1], 2),
                    "x1": round(s["bbox"][2], 2), "y1": round(s["bbox"][3], 2),
                    "oy": round(s["origin"][1], 2),
                    "text": "".join(c["c"] for c in chars),
                    "cx": [round(c["bbox"][0], 2) for c in chars] + [round(chars[-1]["bbox"][2], 2)],
                })
    return out


def main():
    os.makedirs(os.path.join(CACHE, "spans"), exist_ok=True)
    for ch in range(1, 19):
        doc = pymupdf.open(os.path.join(CACHE, "src", f"ch{ch:02d}.pdf"))
        pages = [spans_of(p) for p in doc]
        with open(os.path.join(CACHE, "spans", f"ch{ch:02d}.json"), "w") as f:
            json.dump(pages, f, ensure_ascii=False)
        print(ch, len(pages), sum(len(p) for p in pages), file=sys.stderr)


if __name__ == "__main__":
    main()
