# Gita data build (`scripts/build_db`)

Rebuilds the app's prebuilt SQLite database `assets/db/gita.db` and the small
JSON fallback `assets/db/gita-lite.json` from the bundled gita/gita data
(`src/gita-data/*.json`) plus the open datasets in `scripts/out/opensource/`.
Nothing under `_restricted_do_not_bundle/` is used, and `scripts/scrape_supersite.py`
is not run.

## Run

```sh
python3 -m venv scripts/.venv
scripts/.venv/bin/pip install -r scripts/build_db/requirements.txt
scripts/.venv/bin/python scripts/build_db/build.py            # full build (about 30 s)
scripts/.venv/bin/python scripts/build_db/build.py --measure  # also report FTS layout sizes
scripts/.venv/bin/python scripts/build_db/build.py --refresh-audio  # re-run the CDN HEAD check
```

The build stops if a validator reports an unexplained outlier. Each step can also be run on its own:

| step | script | outputs |
|---|---|---|
| 1 | `build_verses.py`: speaker, padas, meter, display lines, IAST, search keys; text is cross-checked against Besant 1922 and DCS | `scripts/out/build/verses.json`, `scripts/out/formatting_changes.md` |
| 2 | `validate_verses.py`: structure, syllable counts, dandas, hyphens, IAST round-trip, 2-of-3 agreement with Besant and DCS | stdout |
| 3 | `clean_texts.py` (rules in `textfix.py`): typographic cleanup of translations, commentaries and chapter summaries into JSON blocks; adds the Besant, Andhra Bhagavadgita and Bharathi texts | `texts.json`, `authors.json`, `sources.json`, `chapters.json`, `scripts/out/text_cleanup_report.md`, `scripts/out/review/index.html` |
| 4 | `validate_texts.py`: dandas, pipes, quotes, NFC, zero-width characters, pratīka markers, verse-quote shape | stdout |
| 5 | `build_words.py`: DCS morphology in readable English; parsed word meanings aligned to DCS | `words.json`, `word_meanings.json` |
| 6 | `check_audio.py`: HEAD-checks the 701 jsDelivr URLs (5 parallel, with a delay) and lists the GitHub tree | `audio.json` (cached) |
| 7 | `build_sqlite.py`: schema, FTS5 indexes, VACUUM | `assets/db/gita.db`, `assets/db/gita-lite.json` |
| 8 | `test/test_db_js.mjs`: smoke test of `src/gita-data/db.js` against the built DB (node, using a python sqlite bridge) | stdout |

Manual decisions such as editorial variants, truncated text and the mid-verse speaker
(1.21, 1.28) live in `overrides.py`, and each has a reason. Explained validator
outliers are listed in `validate_verses.py` (`EXPLAINED`) and `validate_texts.py` (`MANUAL`).

## Schema (gita.db, schema_version 1)

- `chapters(number, name_sa, name_translit, name_en, meaning, summary_en, summary_hi, summary_en_blocks, summary_hi_blocks, verse_count, image_name)`
- `verses(id, chapter, verse, speaker, speaker_iast, speaker_en, speaker_position, meter, lines_json, padas_json, iast_lines_json, iast_padas_json, pada_syllables_json, split_words_json, ascii_key, transliteration_legacy, word_meanings_legacy)`
  - `lines_json` holds the display lines without the verse number. Anushtubh uses 2 lines (`… ।`, `… ॥`). Trishtubh and jagati use 4 lines, with `।` after line 2, `॥` after line 4, and a trailing `-` where a word runs across padas.
  - `speaker_position` is the pada index the speaker label precedes. It is 0 except for 1.21 and 1.28, where it is 2.
- `authors(id, name, lang, kind translation|commentary|both, tradition, era, license, attribution, source_url, work, public_domain)`
- `texts(id, verse_id, verse_id_end, author_id, type, lang, body, plain, word_count, placeholder)`
  - `body` is a JSON block array: `paragraph {text, label?}`, `heading {text}`, `verse_quote {lines, text, ref?, meter?}`. `⟦…⟧` inside `text` marks a pratīka, which the UI should render bold.
  - `plain` is NULL in the default build (the FTS index is contentless). `db.js` builds snippets from `body`.
  - `verse_id_end` is greater than `verse_id` for grouped renderings, such as Bharathi's Tamil text for 1.4–6.
  - `placeholder` is 1 for "did not comment on this sloka" stubs and for the empty 18.2 entries.
- `words(verse_id, idx, form, unsandhied, form_dev, lemma, lemma_dev, pos, morph)`: DCS (CC BY 4.0). `morph` reads like "noun · locative · singular · neuter".
- `word_meanings(verse_id, idx, term_iast, term_dev, meaning, dcs_idx_json)`
- `audio(verse_id, url, fallback_url, bytes, cdn_ok, duplicate_of)`
- `sources(id, name, license, attribution, url)`: attribution text, including the Project Madurai header and the Andhra poet's introduction.
- `meta(key, value)`
- FTS5:
  - `verse_fts(deva, iast, ascii, phon, meanings, lemmas)` uses the trigram tokenizer, so substring search works in any script. `phon` is a loose phonetic key: `krishna` and `kṛṣṇa` both map to `krsna`.
  - `text_fts(plain)` is contentless and uses `unicode61 remove_diacritics 2`. Indic vowel signs and viramas are declared as token characters; without that, unicode61 splits Devanagari, Telugu and Tamil words at every matra.

## App integration notes

- Add `"db"` to `config.resolver.assetExts` in `metro.config.js`.
- Open the database with `<SQLiteProvider {...GITA_DB_PROVIDER_PROPS}>` and `createGitaDb(useSQLiteContext())`, or with `await openGitaDb()`. Both are exported from `src/gita-data/db.js`.
- Bump `GITA_DB_VERSION` in `db.js` whenever `gita.db` changes. The asset import never overwrites an existing file, so a new file name is what forces the update.
- expo-sqlite 58 bundles SQLite 3.53.3 with FTS5 enabled by default (`enableFTS`). The trigram tokenizer needs SQLite 3.34 or later.
