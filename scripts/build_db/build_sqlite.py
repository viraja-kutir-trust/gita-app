"""Task 4: build assets/db/gita.db (prebuilt SQLite for expo-sqlite) and the
small JSON fallback assets/db/gita-lite.json.

  python build_sqlite.py              # build the chosen layout
  python build_sqlite.py --measure    # also build every FTS variant and report sizes

Inputs: scripts/out/build/{verses,texts,authors,sources,chapters,words,word_meanings,audio}.json
"""
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(__file__))
import deva as D  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
B = os.path.join(ROOT, "scripts", "out", "build")
DB_DIR = os.path.join(ROOT, "assets", "db")
SCHEMA_VERSION = 1

# Indic combining marks must be token characters, otherwise unicode61 splits
# Devanagari/Telugu/Tamil words at every vowel sign and virama.
_MARKS = [(0x0900, 0x0903), (0x093A, 0x094F), (0x0951, 0x0957), (0x0962, 0x0963), (0x093D, 0x093D),
          (0x0C00, 0x0C04), (0x0C3C, 0x0C56), (0x0C62, 0x0C63), (0x0B82, 0x0B83), (0x0BBE, 0x0BCD),
          (0x0BD7, 0x0BD7), (0x200C, 0x200D)]
TOKENCHARS = "".join(chr(c) for a, b in _MARKS for c in range(a, b + 1))
UNICODE61 = "unicode61 remove_diacritics 2 tokenchars '%s'" % TOKENCHARS

SCHEMA = """
PRAGMA page_size = 4096;
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;
CREATE TABLE chapters(
  number INTEGER PRIMARY KEY, name_sa TEXT, name_translit TEXT, name_en TEXT, meaning TEXT,
  summary_en TEXT, summary_hi TEXT, summary_en_blocks TEXT, summary_hi_blocks TEXT,
  verse_count INTEGER, image_name TEXT);
CREATE TABLE verses(
  id INTEGER PRIMARY KEY, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
  speaker TEXT, speaker_iast TEXT, speaker_en TEXT, speaker_position INTEGER DEFAULT 0,
  meter TEXT, lines_json TEXT, padas_json TEXT, iast_lines_json TEXT, iast_padas_json TEXT,
  pada_syllables_json TEXT, split_words_json TEXT,
  ascii_key TEXT, transliteration_legacy TEXT, word_meanings_legacy TEXT,
  UNIQUE(chapter, verse));
CREATE TABLE authors(
  id INTEGER PRIMARY KEY, name TEXT, lang TEXT, kind TEXT, tradition TEXT, era TEXT,
  license TEXT, attribution TEXT, source_url TEXT, work TEXT, public_domain INTEGER);
CREATE TABLE texts(
  id INTEGER PRIMARY KEY, verse_id INTEGER NOT NULL, verse_id_end INTEGER NOT NULL,
  author_id INTEGER NOT NULL, type TEXT NOT NULL, lang TEXT, body TEXT, plain TEXT, -- plain is NULL unless --with-plain
  word_count INTEGER, placeholder INTEGER DEFAULT 0);
CREATE INDEX texts_by_verse ON texts(verse_id, type, author_id);
CREATE INDEX texts_by_author ON texts(author_id, verse_id);
CREATE TABLE words(
  verse_id INTEGER, idx INTEGER, form TEXT, unsandhied TEXT, form_dev TEXT, lemma TEXT, lemma_dev TEXT,
  pos TEXT, morph TEXT, PRIMARY KEY(verse_id, idx)) WITHOUT ROWID;
CREATE TABLE word_meanings(
  verse_id INTEGER, idx INTEGER, term_iast TEXT, term_dev TEXT, meaning TEXT, dcs_idx_json TEXT,
  PRIMARY KEY(verse_id, idx)) WITHOUT ROWID;
CREATE TABLE audio(
  verse_id INTEGER PRIMARY KEY, url TEXT, fallback_url TEXT, bytes INTEGER, cdn_ok INTEGER,
  duplicate_of TEXT);
CREATE TABLE sources(id TEXT PRIMARY KEY, name TEXT, license TEXT, attribution TEXT, url TEXT) WITHOUT ROWID;
"""

# --------------------------------------------------------------- FTS layouts
# verse_fts: one row per verse (rowid = verse id); trigram => substring search in
# any script ('ण्येवा', 'karmanye', 'dhikara'); tiny, so content is stored.
VERSE_FTS = """
CREATE VIRTUAL TABLE verse_fts USING fts5(
  deva, iast, ascii, phon, meanings, lemmas, tokenize = 'trigram', detail = %s);
"""
# text_fts: translations + commentaries, word tokens; external content = texts(plain)
TEXT_FTS = {
    "regular_full": "CREATE VIRTUAL TABLE text_fts USING fts5(plain, tokenize = \"%s\", detail = full);",
    "external_full": "CREATE VIRTUAL TABLE text_fts USING fts5(plain, content = 'texts', content_rowid = 'id', tokenize = \"%s\", detail = full);",
    "external_column": "CREATE VIRTUAL TABLE text_fts USING fts5(plain, content = 'texts', content_rowid = 'id', tokenize = \"%s\", detail = column);",
    "external_none": "CREATE VIRTUAL TABLE text_fts USING fts5(plain, content = 'texts', content_rowid = 'id', tokenize = \"%s\", detail = none);",
    "contentless_column": "CREATE VIRTUAL TABLE text_fts USING fts5(plain, content = '', tokenize = \"%s\", detail = column);",
    "contentless_full": "CREATE VIRTUAL TABLE text_fts USING fts5(plain, content = '', tokenize = \"%s\", detail = full);",
    "external_full_prefix23": "CREATE VIRTUAL TABLE text_fts USING fts5(plain, content = 'texts', content_rowid = 'id', tokenize = \"%s\", detail = full, prefix = '2 3');",
}
# contentless: texts.plain is not stored (saves ~31 MB); db.js builds snippets from texts.body.
CHOSEN_TEXT_FTS = "contentless_full"
CHOSEN_VERSE_DETAIL = "full"


def J(x):
    return json.dumps(x, ensure_ascii=False, separators=(",", ":"))


def load(name):
    return json.load(open(os.path.join(B, name)))


def fill_base(con, with_plain=True):
    verses = load("verses.json")
    texts = load("texts.json")
    authors = load("authors.json")
    sources = load("sources.json")
    chapters = load("chapters.json")
    words = load("words.json")
    meanings = load("word_meanings.json")
    audio = load("audio.json")
    con.executescript(SCHEMA)
    con.executemany("INSERT INTO chapters VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
        (c["number"], c["name_sa"], c["name_translit"], c["name_en"], c["meaning"], c["summary_en"], c["summary_hi"],
         J(c["summary_en_blocks"]), J(c["summary_hi_blocks"]), c["verse_count"], c.get("image_name")) for c in chapters])
    con.executemany("INSERT INTO verses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
        (v["id"], v["chapter"], v["verse"], v["speaker"], v["speaker_iast"], v["speaker_en"], v["speaker_position"],
         v["meter"], J(v["lines"]), J(v["padas"]), J(v["iast_lines"]), J(v["iast_padas"]), J(v["pada_syllables"]),
         J(v["split_words"]), v["ascii_key"], v["transliteration_legacy"], v["word_meanings_legacy"]) for v in verses])
    con.executemany("INSERT INTO authors VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
        (a["id"], a["name"], a["lang"], a["kind"], a["tradition"], a["era"], a["license"], a["attribution"],
         a["source_url"], a.get("work"), a.get("public_domain", 0)) for a in authors])
    con.executemany("INSERT INTO texts(verse_id, verse_id_end, author_id, type, lang, body, plain, word_count, placeholder) "
                    "VALUES (?,?,?,?,?,?,?,?,?)", [
                        (t["verse_id"], t["verse_id_end"], t["author_id"], t["type"], t["lang"], J(t["blocks"]),
                         t["body"] if with_plain else None,
                         t["word_count"], t["placeholder"])
                        for t in sorted(texts, key=lambda t: (t["verse_id"], t["type"], t["author_id"]))])
    con.executemany("INSERT INTO words VALUES (?,?,?,?,?,?,?,?,?)", [
        (w["verse_id"], w["idx"], w["form"], w["unsandhied"], w["form_dev"], w["lemma"], w["lemma_dev"], w["pos"], w["morph"])
        for w in words])
    con.executemany("INSERT INTO word_meanings VALUES (?,?,?,?,?,?)", [
        (m["verse_id"], m["idx"], m["term_iast"], m["term_dev"], m["meaning"], J(m["dcs_idx"])) for m in meanings])
    con.executemany("INSERT INTO audio VALUES (?,?,?,?,?,?)", [
        (r["verse_id"], r["url"], r["fallback_url"], r.get("github_bytes") or r.get("bytes"), int(r["status"] == 200),
         ",".join(r.get("duplicate_of") or []) or None)
        for r in audio["results"] if r["verse_id"]])
    con.executemany("INSERT INTO sources VALUES (?,?,?,?,?)", [
        (s["id"], s["name"], s["license"], s["attribution"], s["url"]) for s in sources])
    return verses, words, meanings


def fill_verse_fts(con, verses, words, meanings, detail):
    con.executescript(VERSE_FTS % detail)
    wm = {}
    for m in meanings:
        wm.setdefault(m["verse_id"], []).append(m)
    lem = {}
    for w in words:
        lem.setdefault(w["verse_id"], set()).update([w["lemma"], w["lemma_dev"]])
    rows = []
    for v in verses:
        deva = " ".join(([v["speaker"]] if v["speaker"] else []) + v["padas"])
        # Devanagari search key: also without avagraha / with nasal normalisation
        deva_n = D.norm(deva)
        iast = " ".join(([v["speaker_iast"]] if v["speaker_iast"] else []) + v["iast_padas"])
        ascii_ = v["ascii_key"] + " " + v["ascii_key_compact"]
        phon = D.fold_phonetic(v["ascii_key"]) + " " + D.fold_phonetic(v["ascii_key_compact"])
        ms = wm.get(v["id"], [])
        meanings_txt = " ; ".join("%s %s %s %s" % (m["term_dev"], D.fold_ascii(m["term_iast"]), m["term_iast"], m["meaning"]) for m in ms)
        lemmas = " ".join(sorted(lem.get(v["id"], []))) + " " + " ".join(sorted({D.fold_ascii(x) for x in lem.get(v["id"], [])}))
        rows.append((v["id"], deva + " " + deva_n, iast, ascii_, phon, meanings_txt, lemmas))
    con.executemany("INSERT INTO verse_fts(rowid, deva, iast, ascii, phon, meanings, lemmas) VALUES (?,?,?,?,?,?,?)", rows)


def fill_text_fts(con, layout):
    con.execute(TEXT_FTS[layout] % UNICODE61.replace('"', '""'))
    if layout.startswith("contentless"):
        texts = load("texts.json")
        order = sorted(texts, key=lambda t: (t["verse_id"], t["type"], t["author_id"]))
        ids = [r[0] for r in con.execute("SELECT id FROM texts ORDER BY id")]
        con.executemany("INSERT INTO text_fts(rowid, plain) VALUES (?,?)", [(i, t["body"]) for i, t in zip(ids, order)])
    elif layout.startswith("regular"):
        con.execute("INSERT INTO text_fts(rowid, plain) SELECT id, plain FROM texts")
    else:
        con.execute("INSERT INTO text_fts(text_fts) VALUES ('rebuild')")
    con.execute("INSERT INTO text_fts(text_fts) VALUES ('optimize')")


def table_sizes(path):
    con = sqlite3.connect(path)
    try:
        rows = con.execute("SELECT name, SUM(pgsize) FROM dbstat GROUP BY name ORDER BY 2 DESC").fetchall()
    except sqlite3.OperationalError:
        rows = []
    con.close()
    return rows


def build(path, text_layout, verse_detail):
    if os.path.exists(path):
        os.remove(path)
    con = sqlite3.connect(path)
    verses, words, meanings = fill_base(con, with_plain=not text_layout.startswith("contentless"))
    fill_verse_fts(con, verses, words, meanings, verse_detail)
    fill_text_fts(con, text_layout)
    con.executemany("INSERT INTO meta VALUES (?,?)", [
        ("schema_version", str(SCHEMA_VERSION)),
        ("built_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
        ("text_fts_layout", text_layout),
        ("tokenizer", "unicode61 remove_diacritics 2 + Indic marks as tokenchars; verse_fts trigram"),
        ("verse_count", str(len(verses))),
    ])
    con.commit()
    con.execute("ANALYZE")
    con.commit()
    con.execute("VACUUM")
    con.close()
    return os.path.getsize(path)


def write_lite():
    verses = load("verses.json")
    chapters = load("chapters.json")
    lite = dict(
        schema_version=SCHEMA_VERSION,
        chapters=[dict(number=c["number"], name_sa=c["name_sa"], name_translit=c["name_translit"], name_en=c["name_en"],
                       meaning=c["meaning"], verse_count=c["verse_count"], summary_en=c["summary_en"], summary_hi=c["summary_hi"])
                  for c in chapters],
        verses=[dict(id=v["id"], c=v["chapter"], v=v["verse"], speaker=v["speaker"], speaker_iast=v["speaker_iast"],
                     sp_pos=v["speaker_position"] or None, meter=v["meter"], lines=v["lines"], iast=v["iast_lines"],
                     key=v["ascii_key_compact"]) for v in verses])
    p = os.path.join(DB_DIR, "gita-lite.json")
    json.dump(lite, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(p)


def main():
    os.makedirs(DB_DIR, exist_ok=True)
    report = []
    if "--measure" in sys.argv:
        tmp = tempfile.mkdtemp()
        for layout in TEXT_FTS:
            for vd in ("full", "none"):
                if vd == "none" and layout != CHOSEN_TEXT_FTS:
                    continue
                p = os.path.join(tmp, "%s_%s.db" % (layout, vd))
                size = build(p, layout, vd)
                sizes = dict(table_sizes(p))
                fts = sum(v for k, v in sizes.items() if k.startswith("text_fts"))
                vfts = sum(v for k, v in sizes.items() if k.startswith("verse_fts"))
                report.append((layout, vd, size, fts, vfts))
                print("layout=%-24s verse_fts.detail=%-4s total=%6.1f MB  text_fts=%5.1f MB  verse_fts=%4.2f MB"
                      % (layout, vd, size / 1e6, fts / 1e6, vfts / 1e6))
        shutil.rmtree(tmp)
        json.dump(report, open(os.path.join(B, "fts_size_report.json"), "w"), indent=1)
    path = os.path.join(DB_DIR, "gita.db")
    size = build(path, CHOSEN_TEXT_FTS, CHOSEN_VERSE_DETAIL)
    print("assets/db/gita.db: %.1f MB (layout %s)" % (size / 1e6, CHOSEN_TEXT_FTS))
    for name, sz in table_sizes(path)[:25]:
        print("   %-28s %7.2f MB" % (name, sz / 1e6))
    lite = write_lite()
    print("assets/db/gita-lite.json: %.2f MB" % (lite / 1e6))


if __name__ == "__main__":
    main()
