"""Download source scans / OCR / mirror pages into scripts/out/pd_sources/_cache (idempotent)."""
import os, sys, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import *


def get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    print('GET', url)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (gita-pd-digitisation; non-profit)'})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest + '.part', 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    os.replace(dest + '.part', dest)


def main():
    for ident, files in ((SW_ID, SW_FILES), (MS_ID, MS_FILES)):
        for local, remote in files.items():
            get('https://archive.org/download/%s/%s' % (ident, urllib.parse.quote(remote)), os.path.join(CACHE, local))
    for i in range(26):
        get(SACRED_BASE + 'sbg%02d.htm' % i, os.path.join(CACHE, 'sacred', 'sbg%02d.htm' % i))
    for name, url in TESS_MODELS.items():
        get(url, os.path.join(TESSDATA, name + '.traineddata'))


if __name__ == '__main__':
    main()
