"""Download the 18 chapter PDFs (and archive.org's OCR, used only to check the decoder).

  scripts/.venv/bin/python scripts/nirvikalpananda/fetch.py

Files go to scripts/out/nirvikalpananda/_cache/src/ (about 40 MB); existing files are kept.
"""
import os
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(ROOT, "scripts", "out", "nirvikalpananda", "_cache", "src")
ITEM = "https://archive.org/download/geeta-telugu-with-word2word-meaning-and-translation/"


def get(name, dest):
    path = os.path.join(SRC, dest)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return
    url = ITEM + urllib.parse.quote(name)
    with urllib.request.urlopen(url) as r, open(path + ".part", "wb") as f:
        f.write(r.read())
    os.replace(path + ".part", path)
    print("fetched", dest)


def main():
    os.makedirs(SRC, exist_ok=True)
    for ch in range(1, 19):
        get(f"Chapter {ch:02d}.pdf", f"ch{ch:02d}.pdf")
        get(f"Chapter {ch:02d}_hocr.html", f"ch{ch:02d}_hocr.html")


if __name__ == "__main__":
    main()
