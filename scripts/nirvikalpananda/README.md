# Swami Nirvikalpananda's Telugu Gita (`scripts/nirvikalpananda`)

Source: *Srimad Bhagavad Gita* in Telugu by Swami Nirvikalpananda (Ramakrishna Order),
PDFs at <https://archive.org/details/geeta-telugu-with-word2word-meaning-and-translation>,
uploaded by the rights holder for free use (Public Domain Mark). Each verse has the
sloka, the **padaccheda** (the verse with its words split), the **word-by-word meaning**
in Telugu, the **translation** (తాత్పర్యం) and **footnotes**.

```sh
scripts/nirvikalpananda/run_all.sh     # fetch → decode → parse → validate → add to gita.db
```

then bump `GITA_DB_VERSION` in `src/gita-data/db.js`. If `gita.db` is rebuilt from
scratch (`scripts/build_db/build.py`), run `scripts/pd_sources/integrate.py` and then
`scripts/nirvikalpananda/integrate.py` again.

## How the text is read

The PDFs (PageMaker 7, 2010) are set in the legacy **Anu** Telugu fonts (Priyaanka,
Gowthami, Pragathi, …). Their text layer is not Unicode: every glyph is a Latin-1/MacRoman
code (`^èŒ$`«~å¢+¨ì` = ధృతరాష్ట్ర). archive.org's OCR of the scans confuses many
letters (ప/వ, న/స, ష్ట/ష్ఠ, చ్చ/చ్ఛ, ద్ది/ద్ధి), so it is **not** used as text. Instead the glyphs are
decoded deterministically:

| step | script | what it does |
|---|---|---|
| fetch | `fetch.py` | 18 chapter PDFs + archive.org hOCR (the hOCR is only used to check the decoder) |
| glyphs | `extract.py` | every span with font, size, position and per-glyph x |
| decoder | `anu.py`, `anu_glyphs.py` | glyph roles (base, talakattu, vowel signs, vattus, ra-vattu prefix …) → Unicode syllables |
| check | `learn_map.py`, `check_map.py` | pairs each PDF word with the OCR word at the same place (58,805 words) and lists glyph clusters where the decoder and the OCR majority disagree; every remaining disagreement was checked against the page image and is an OCR error |
| lines | `lines.py` | groups spans into lines, re-attaches marks split across spans, conjunct pieces set as separate small boxes (క్ష under ఙ in కాఙ్క్షతి), and footnote superscripts (placed after the word they follow) |
| parse | `parse.py` | sloka / padaccheda / two-column word list / translation / page footnotes → units; `align.py` maps the printed lines onto gita.db's verses |
| harden | `harden.py` (+ `term_fixes.tsv`, `prose_fixes.tsv`, `review_prose.py`) | gita.db's Sanskrit is the blueprint: slokas, padaccheda and word terms are made to agree with it; reviewed Telugu fixes; every change logged in `dataset/corrections.md` |
| validate | `validate.py` | every sloka, transliterated to Devanagari, compared with gita.db |
| DB | `integrate.py` | translation into `texts` (author 22), padaccheda + words into `study_units` |

## Dataset: `dataset/nirvikalpananda.json`

Telugu throughout, as printed. `⁽n⁾` in any text refers to the unit's footnote `n`.

```jsonc
{
  "chapters": { "2": { "title", "intro": [lines], "intro_footnotes": [...], "colophon": [lines], "colophon_footnotes": [...] } },
  "units": {                       // a verse, or verses the book explains together
    "1.4-6": {
      "chapter": 1, "verses": [4, 5, 6], "label": "4–6",   // label = the book's own number(s)
      "blocks": [ { "speaker"?, "lines": [sloka lines], "verses": [verse per line], "padaccheda": "అత్ర, శూరాః, …" } ],
      "words": [ { "term": "అత్ర", "meaning": "అక్కడ", "implied"?: true, "term_notes"?: [1] } ],
      "preface"?: [paragraphs printed before "తా॥"],
      "translation": [paragraphs],
      "footnotes": [ { "n": 1, "text": "…", "unanchored"?: true } ]
    }
  },
  "verses": { "1.21": { "units": ["1.20-21", "1.21-23"] } }   // gita.db numbering
}
```

672 units cover all 701 verses: 7,776 word meanings, 474 verse footnotes (+22 on chapter
intros/closings), 30 grouped units. The book prints six verses (1.21, 1.27, 1.28, 1.30–32)
split across two passages; those verses list both units. The book numbers Arjuna's
question in chapter 13 as 0, so book 13.n is gita.db 13.(n+1); matching is by text.

In gita.db: `texts` rows of author 22 (`lang = 'telugu'`, blocks `paragraph` with ⁽n⁾
markers + one `footnotes` block), `study_units(id, source, chapter, verse_id, verse_id_end,
label, data)`, `study_verse_units(source, verse_id, unit_id, ord)` and `study_chapters`.

## Hardening (`harden.py`)

gita.db's Sanskrit text is treated as the blueprint; every change is logged in
`dataset/corrections.md` (book word → corrected word, and why).

1. **Slokas**: each printed line is replaced by gita.db's line of the same verse in
   Telugu script (the book's line is kept as `book_lines`). 835 word-level
   differences were logged: 513 were only joins/splits (sandhi spacing), 322 were
   readings or spellings (including the book's misprints and variants below).
2. **Padaccheda**: every word is matched, in order, against the verse: its stem must
   occur at that place in the sloka, allowing only what sandhi changes at word
   edges (final visarga/anusvāra/consonant, a vowel merged with the previous word,
   श→छ after त्, -नि→-न्य before a vowel). 77 words were corrected by review
   (`term_fixes.tsv`), e.g. ప్రళయ→ప్రలయ, తిష్ట→తిష్ఠ, బుద్ధమ్→ఋద్ధమ్ (2.8), and the
   1.28 forms (ఇమాన్ స్వజనాన్ → ఇమమ్ స్వజనమ్, as gita.db reads).
3. **Word-by-word Sanskrit terms**: every term word must be a word of the verified
   padaccheda (or a compound member, or the speaker label). 41 run-together terms
   were split (రాజాదుర్యోధనః → రాజా దుర్యోధనః) and 109 corrected by review
   (అస్య→తస్య, మహాపాప్మాః→మహాపాప్మా, యోగి→యోగీ …).
4. **Telugu meanings, translations and notes** (no second copy exists):
   `review_prose.py` lists words where the archive.org OCR, at the same place, reads a
   common word and ours is rare, and rare words one letter away from a common word;
   every candidate (about 800) was read in context. 60 fixes (`prose_fixes.tsv`):
   typos (ఏందుకంటే, మృతువు, పుర్వజన్మలో …), words split by a stray space
   (ఉపదేశించ బడింది) and run together (కూడానా). All recurring OCR disagreements were
   checked: in each the OCR is wrong (శ్రేష్ఠ/శ్రేష్ట, గచ్ఛతి/గచ్చతి, సూత్రమ్/నూత్రమ్ …).
   The text is also checked for impossible letter sequences (none).
5. Three verses the book deliberately prints with another reading (3.26 యోజయేత్, 7.11
   బలవతామస్మి, 18.13 పంచేమాని) now follow gita.db; their footnotes, which named gita.db's
   reading as the variant, now name the book's reading instead.

## Verification

* **Slokas** (before hardening): after normalisation (anusvāra/nasal, visarga sandhi spacing, the book's
  త్త్ర for త్ర) the decoded text of every verse was diffed with gita.db. All remaining
  differences were checked on the page images; none is a decoding error. They are the
  book's own readings or spellings, kept as printed:
  ళ for ల (బహుళ, కళేబర), మానావమాన (6.7, 12.18, 14.25), యోజయేత్ (3.26), బలవతామస్మి (7.11),
  దృష్ట్వేమాన్ స్వజనాన్ … సముపస్థితాన్ (1.28), అసంశయః (8.7), అధిష్ఠితమ్ (13.18),
  విధిదిష్టో (17.11), పంచేమాని (18.13), షష్ఠాణీ (15.7), శ్రద్ధధానాః (12.20), ఉద్ధిశ్య (17.21) — and
  misprints in the book: నినద్యో (1.12), సజ్గ (2.62), యోగభ్రషో (6.41), అవ్యమమ్ (9.18),
  ఉత్తమాఙ్ఘైః (11.27), గచ్చన్తి/తిష్టన్తి (14.18).
* **Telugu prose**: decoder vs OCR majority for every glyph cluster (`check_map.py`), plus
  page-by-page spot checks against the scans.
* **Decoder rules from the scans**: the book types ఋ with the glyphs of బు (ఋషి, ఋతు, ఋక్ are
  restored; బుద్ధి etc. are not touched), ఠ is the ర body with a dot, ఘ is ఫ with the hook,
  and one bare ర body is the book's ం (2.62 పుంసః).
* `dataset/parse_report.md` lists everything the parser flagged: notes that continue on the
  next page, a marker with no note in the book (11.2, marker 4), three notes printed
  without a marker (kept with 15.7, 18.7 and 18.69 as `unanchored`), and translations whose
  closing verse number the book omitted.

Known limits: spaces inside a few words come from the book's justified lines (e.g.
"ధార్త రాష్ట్రాణామ్" in a padaccheda); 10.34's bracketed list of seven names was set as one
entry by hand (`fix_words` in `parse.py`).
