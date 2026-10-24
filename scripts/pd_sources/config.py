"""Shared paths/constants for the public-domain source digitisation pipeline."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))          # repo root
DB = os.path.join(ROOT, 'assets', 'db', 'gita.db')
OUT = os.path.join(ROOT, 'scripts', 'out', 'pd_sources')
CACHE = os.path.join(OUT, '_cache')
TESSDATA = os.path.join(CACHE, 'tessdata')
SW_TESS = os.path.join(CACHE, 'sw_tess')        # our tesseract re-OCR of the Swarupananda scan

# --- Swami Swarupananda, Srimad-Bhagavad-Gita, 1st ed. 1909 (Prabuddha Bharata Press, Mayavati)
SW_ID = 'in.ernet.dli.2015.386852'
SW_FILES = {
    'sw.pdf': '2015.386852.Srimad-Bhagavad.pdf',
    'sw_hocr.html': '2015.386852.Srimad-Bhagavad_hocr.html',
    'sw386852.txt': '2015.386852.Srimad-Bhagavad_djvu.txt',
}
SACRED_BASE = 'https://neonvagabond.xyz/mirrors/sacred-texts/hin/sbg/'

# --- A. Mahadeva Sastri, The Bhagavad-Gita with the commentary of Sri Sankaracharya, 2nd ed. 1901
MS_ID = 'bhagavadgitawith00maharich'
MS_FILES = {
    'ms.pdf': 'bhagavadgitawith00maharich.pdf',
    'ms_hocr.html': 'bhagavadgitawith00maharich_hocr.html',
    'ms.txt': 'bhagavadgitawith00maharich_djvu.txt',
}

TESS_MODELS = {
    'eng': 'https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata',
    'san': 'https://github.com/tesseract-ocr/tessdata_best/raw/main/san.traineddata',
    'Devanagari': 'https://github.com/tesseract-ocr/tessdata_best/raw/main/script/Devanagari.traineddata',
}
