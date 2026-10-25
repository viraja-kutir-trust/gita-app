#!/bin/sh
# Rebuild Swami Nirvikalpananda's Telugu dataset and add it to assets/db/gita.db.
set -e
cd "$(dirname "$0")/../.."
PY=scripts/.venv/bin/python
$PY -m pip install -q pymupdf indic_transliteration
$PY scripts/nirvikalpananda/fetch.py
$PY scripts/nirvikalpananda/extract.py
$PY scripts/nirvikalpananda/learn_map.py      # OCR votes, only for check_map.py
$PY scripts/nirvikalpananda/check_map.py 3 | head -1
$PY scripts/nirvikalpananda/parse.py
$PY scripts/nirvikalpananda/harden.py          # gita.db Sanskrit as blueprint + reviewed fixes
$PY scripts/nirvikalpananda/validate.py > /dev/null
$PY scripts/nirvikalpananda/integrate.py
echo "Now bump GITA_DB_VERSION in src/gita-data/db.js if gita.db changed."
