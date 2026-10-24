#!/usr/bin/env bash
# Reproduce scripts/out/pd_sources/* from scratch.  Needs: python3 (scripts/.venv), tesseract 5,
# poppler (pdfimages/pdftoppm/pdfinfo), ImageMagick (magick).  ~1 GB peak disk, ~45 min on 8 cores.
set -euo pipefail
cd "$(dirname "$0")"
PY=../.venv/bin/python
$PY -m pip install -q indic_transliteration >/dev/null 2>&1 || true
$PY -I fetch.py                                   # archive.org scans/OCR, sacred-texts mirror, tessdata_best
JOBS=${JOBS:-7}
JOBS=$JOBS $PY -I ocr_sw.py                       # Swarupananda: tesseract eng+san
OCR_PREP=1 JOBS=$JOBS $PY -I ocr_sw.py            #   ... same on 2x-smoothed page images (primary reading)
OCR_LANG=san JOBS=$JOBS $PY -I ocr_sw.py          #   ... Devanagari-only readings for the headwords
OCR_LANG=Devanagari JOBS=$JOBS $PY -I ocr_sw.py
JOBS=$JOBS $PY -I ocr_ms.py                       # Mahadeva Sastri: tesseract eng (second witness)
rm -f ../out/pd_sources/_cache/sw_lines.pkl
$PY -I swarupananda.py
$PY -I mahadevasastri.py
$PY -I review.py
$PY -I report.py
