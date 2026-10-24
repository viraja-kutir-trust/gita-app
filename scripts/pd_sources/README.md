# Public-domain Gita sources: Swarupananda (1909) and Mahadeva Sastri (1901)

One command rebuilds everything in `scripts/out/pd_sources/`:

```sh
scripts/pd_sources/run_all.sh          # JOBS=7 by default (parallel tesseract processes)
```

Requirements: `scripts/.venv` (Python 3; `indic_transliteration` is installed by the script),
tesseract 5, poppler (`pdfimages`, `pdftoppm`, `pdfinfo`), ImageMagick 7 (`magick`).
Downloads (~120 MB) and OCR output (~150 MB) go to `scripts/out/pd_sources/_cache/`; page images
are extracted one at a time and deleted right after OCR.  Every step is idempotent (already
downloaded / OCR'd pages are skipped), so a re-run only redoes the parsing (~1 min).

| step | script | what it does |
|---|---|---|
| fetch | `fetch.py` | archive.org PDFs + hOCR + djvu.txt for both books, the sacred-texts mirror (neonvagabond.xyz), tessdata_best `eng`/`san`/`Devanagari` |
| OCR | `ocr_sw.py`, `ocr_ms.py` | tesseract re-OCR (see REPORT.md for why each run exists) |
| Swarupananda | `swarupananda.py` (+ `sw_layout.py`, `sw_anchor.py`, `sw_regions.py`, `sw_wbw.py`, `witness.py`, `sacred.py`, `textfix.py`) | layout → anchor each English rendering against the sacred-texts transcription → cut word-for-word / rendering / comments → parse gloss pairs → map headwords to our DCS word list |
| Mahadeva Sastri | `mahadevasastri.py` (+ `ms_merge.py`, `ms_lexicon.py`) | layout (verse blocks are indented both sides; footnotes are smaller type) → verse / commentary / introduction → ABBYY+tesseract word merge → conservative repair of italic-letter garbles |
| review | `review.py` | `review.html` with scan crops beside the output |
| report | `report.py` (+ `REPORT_TEMPLATE.md`) | `REPORT.md` |

Nothing under `src/` is touched.  Outputs never contain text that is not in the scans: corrections
are limited to OCR mis-readings (documented in REPORT.md), and every verse carries a confidence.
