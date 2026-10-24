"""Re-OCR every page (OCR_LANG=eng+san default; also run with OCR_LANG=san and OCR_LANG=Devanagari
to get Devanagari-only readings of the word-for-word headwords) of the Swarupananda 1909 scan with tesseract (eng+san, tessdata_best) -> hOCR.

The DLI OCR shipped with the scan garbles most Devanagari headwords of the word-for-word
section; tesseract 5 with eng+san reads them far better.  Page images are extracted one at a
time with pdfimages and deleted straight after OCR (keeps disk use small).
"""
import os, re, sys, subprocess, tempfile, glob
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import *

PDF = os.path.join(CACHE, 'sw.pdf')


LANG = os.environ.get('OCR_LANG', 'eng+san')
PREP = os.environ.get('OCR_PREP', '') == '1'      # 2x upscale + blur + re-threshold (helps the noisy bitonal scan)
OUTDIR = SW_TESS if LANG == 'eng+san' else SW_TESS + '_' + LANG.replace('+', '_')
if PREP:
    OUTDIR = SW_TESS + '_prep'


def ocr(page):
    out = os.path.join(OUTDIR, 'p%04d' % page)
    if os.path.exists(out + '.hocr'):
        return page
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(['pdfimages', '-f', str(page), '-l', str(page), '-png', PDF, os.path.join(td, 'im')], check=True)
        ims = sorted(glob.glob(os.path.join(td, 'im*.png')))
        if not ims:
            return page
        if PREP:
            big = os.path.join(td, 'big.png')
            subprocess.run(['magick', ims[0], '-resize', '200%', '-blur', '0x1.2', '-threshold', '55%', big], check=True,
                           env=dict(os.environ, MAGICK_THREAD_LIMIT='1'))
            ims = [big]
        env = dict(os.environ, OMP_THREAD_LIMIT='1')
        subprocess.run(['tesseract', ims[0], out + '.tmp', '--tessdata-dir', TESSDATA, '-l', LANG,
                        '--psm', '3', '-c', 'tessedit_create_hocr=1', '-c', 'tessedit_create_txt=0'],
                       check=True, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if PREP:      # scale coordinates back to the original page frame
            h = open(out + '.tmp.hocr', encoding='utf-8').read()
            h = re.sub(r'bbox (\d+) (\d+) (\d+) (\d+)', lambda m: 'bbox %d %d %d %d' % tuple(int(x) // 2 for x in m.groups()), h)
            h = re.sub(r'x_size ([\d.]+)', lambda m: 'x_size %.2f' % (float(m.group(1)) / 2), h)
            open(out + '.tmp.hocr', 'w', encoding='utf-8').write(h)
        os.replace(out + '.tmp.hocr', out + '.hocr')
    return page


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    n = int(subprocess.run(['pdfinfo', PDF], capture_output=True, text=True).stdout.split('Pages:')[1].split()[0])
    pages = list(range(1, n + 1))
    with ThreadPoolExecutor(max_workers=int(os.environ.get('JOBS', '6'))) as ex:
        for i, p in enumerate(ex.map(ocr, pages)):
            if i % 20 == 0:
                print('ocr page', p, flush=True)


if __name__ == '__main__':
    main()
