"""Second OCR witness for the Mahadeva Sastri scan: tesseract (eng, tessdata_best) per PDF page -> hOCR.

Used only to repair words the archive.org (ABBYY) OCR got wrong.  Page images are extracted one at
a time and deleted right after OCR.
"""
import os, sys, subprocess, tempfile, glob
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import CACHE, TESSDATA

PDF = os.path.join(CACHE, 'ms.pdf')
OUTDIR = os.path.join(CACHE, 'ms_tess')


def ocr(page):
    out = os.path.join(OUTDIR, 'p%04d' % page)
    if os.path.exists(out + '.hocr'):
        return page
    with tempfile.TemporaryDirectory() as td:
        # the PDF stores a colour JPEG2000 + mask per page; render the page instead
        subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-r', '300', '-gray', '-png', PDF,
                        os.path.join(td, 'im')], check=True)
        ims = sorted(glob.glob(os.path.join(td, 'im*.png')))
        if not ims:
            return page
        env = dict(os.environ, OMP_THREAD_LIMIT='1')
        subprocess.run(['tesseract', ims[0], out + '.tmp', '--tessdata-dir', TESSDATA, '-l', 'eng',
                        '--psm', '3', '-c', 'tessedit_create_hocr=1', '-c', 'tessedit_create_txt=0'],
                       check=True, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.replace(out + '.tmp.hocr', out + '.hocr')
    return page


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    n = int(subprocess.run(['pdfinfo', PDF], capture_output=True, text=True).stdout.split('Pages:')[1].split()[0])
    with ThreadPoolExecutor(max_workers=int(os.environ.get('JOBS', '6'))) as ex:
        for i, p in enumerate(ex.map(ocr, range(1, n + 1))):
            if i % 25 == 0:
                print('ocr page', p, flush=True)


if __name__ == '__main__':
    main()
