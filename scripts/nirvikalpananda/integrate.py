"""Add Swami Nirvikalpananda's Telugu Gita to assets/db/gita.db.

  scripts/.venv/bin/python scripts/nirvikalpananda/integrate.py

Idempotent. Reads scripts/nirvikalpananda/dataset/nirvikalpananda.json (parse.py) and:

  * replaces author 22's texts (gita/gita only had 1.1–1.4) with the full Telugu
    translation, one row per unit (verse or group), body blocks:
      paragraph {text, label?}   text may hold ⁽n⁾ footnote markers
      footnotes {items: [{n, text, unanchored?}]}
  * fills study_units / study_verse_units with the padaccheda and word-by-word
    meanings of each unit (source = 'nirvikalpananda'), and study_chapters with
    the chapter intro verse, colophon and their notes.

Remember to bump GITA_DB_VERSION in src/gita-data/db.js after running it.
"""
import json
import os
import re
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(HERE, "dataset", "nirvikalpananda.json")
DB = os.path.join(ROOT, "assets", "db", "gita.db")
SOURCE = "nirvikalpananda"
AUTHOR_ID = 22
URL = "https://archive.org/details/geeta-telugu-with-word2word-meaning-and-translation"
ATTRIBUTION = (
    "Swami Nirvikalpananda, Srimad Bhagavad Gita (Telugu): padaccheda, word-by-word meaning and translation "
    "with footnotes. Digitised from the PDFs at archive.org/details/geeta-telugu-with-word2word-meaning-and-translation, "
    "uploaded by the rights holder for free use."
)
MARK = re.compile(r"⁽(\d+)⁾")

SCHEMA = """
CREATE TABLE IF NOT EXISTS study_units(
  id TEXT PRIMARY KEY, source TEXT NOT NULL, chapter INTEGER NOT NULL,
  verse_id INTEGER NOT NULL, verse_id_end INTEGER NOT NULL, label TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS study_verse_units(
  source TEXT NOT NULL, verse_id INTEGER NOT NULL, unit_id TEXT NOT NULL, ord INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS study_verse_units_by_verse ON study_verse_units(source, verse_id, ord);
CREATE TABLE IF NOT EXISTS study_chapters(
  source TEXT NOT NULL, chapter INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(source, chapter));
"""


def plain(text):
    return MARK.sub("", text)


def fts_text(blocks):
    """What this script indexes for a text row: paragraphs, then the footnotes."""
    paras = "\n\n".join(plain(b["text"]) for b in blocks if b.get("type") == "paragraph")
    notes = " ".join(f["text"] for b in blocks if b.get("type") == "footnotes" for f in b["items"])
    return paras + ("\n\n" + notes if notes else "")


def rowid_is_ours(blocks):
    return any(MARK.search(b.get("text", "")) for b in blocks) or len(blocks) != 1


def main():
    d = json.load(open(DATA))
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA)
    vid = {(c, v): i for i, c, v in con.execute("SELECT id, chapter, verse FROM verses")}

    # author 22: same author as gita/gita's partial text; now complete and attributed
    con.execute(
        "UPDATE authors SET name=?, lang='telugu', kind='translation', tradition=?, era=?, license=?, attribution=?, "
        "source_url=?, work=?, public_domain=1 WHERE id=?",
        ("Swami Nirvikalpananda", "Ramakrishna Order", "2010",
         "Free use (uploaded by the rights holder; archive.org Public Domain Mark)", ATTRIBUTION, URL,
         "Srimad Bhagavad Gita (Telugu) with padaccheda, word meanings and footnotes", AUTHOR_ID),
    )
    # text_fts is contentless: removing a row needs the exact text it was indexed with.
    # Rows from an earlier run of this script are rebuilt from their body; the four
    # gita/gita rows (1.1–1.4) come from build_db's texts.json.
    gg = {}
    build_texts = os.path.join(ROOT, "scripts", "out", "build", "texts.json")
    if os.path.exists(build_texts):
        gg = {t["verse_id"]: t["body"] for t in json.load(open(build_texts)) if t["author_id"] == AUTHOR_ID}
    for rowid, verse_id, body in con.execute("SELECT id, verse_id, body FROM texts WHERE author_id = ?", (AUTHOR_ID,)).fetchall():
        blocks = json.loads(body)
        if any(b.get("type") == "footnotes" for b in blocks) or rowid_is_ours(blocks):
            indexed = fts_text(blocks)
        else:
            indexed = gg.get(verse_id)
        if indexed is not None:
            con.execute("INSERT INTO text_fts(text_fts, rowid, plain) VALUES ('delete', ?, ?)", (rowid, indexed))
    con.execute("DELETE FROM texts WHERE author_id = ?", (AUTHOR_ID,))
    con.execute("DELETE FROM study_units WHERE source = ?", (SOURCE,))
    con.execute("DELETE FROM study_verse_units WHERE source = ?", (SOURCE,))
    con.execute("DELETE FROM study_chapters WHERE source = ?", (SOURCE,))

    n_texts = 0
    for uid, u in d["units"].items():
        ch, vs = u["chapter"], u["verses"]
        first, last = vid[(ch, vs[0])], vid[(ch, vs[-1])]
        blocks = []
        for p in u.get("preface", []):
            blocks.append({"type": "paragraph", "text": p})
        for p in u["translation"]:
            blocks.append({"type": "paragraph", "text": p})
        if u["footnotes"]:
            blocks.append({"type": "footnotes", "items": u["footnotes"]})
        pt = "\n\n".join(plain(b["text"]) for b in blocks if b["type"] == "paragraph")
        cur = con.execute(
            "INSERT INTO texts(verse_id, verse_id_end, author_id, type, lang, body, word_count, placeholder) VALUES (?,?,?,?,?,?,?,0)",
            (first, last, AUTHOR_ID, "translation", "telugu", json.dumps(blocks, ensure_ascii=False), len(pt.split())),
        )
        con.execute("INSERT INTO text_fts(rowid, plain) VALUES (?, ?)", (cur.lastrowid, fts_text(blocks)))
        n_texts += 1
        data = {
            "label": u["label"],
            "verses": vs,
            "blocks": u["blocks"],          # [{lines, verses, padaccheda, speaker?}] book's Telugu text
            "words": u["words"],            # [{term, meaning, implied?, term_notes?}]
            "footnotes": u["footnotes"],
            "textId": cur.lastrowid,
        }
        con.execute(
            "INSERT INTO study_units(id, source, chapter, verse_id, verse_id_end, label, data) VALUES (?,?,?,?,?,?,?)",
            (uid, SOURCE, ch, first, last, u["label"], json.dumps(data, ensure_ascii=False, separators=(",", ":"))),
        )
    for key, v in d["verses"].items():
        ch, vv = map(int, key.split("."))
        for k, uid in enumerate(v["units"]):
            con.execute("INSERT INTO study_verse_units(source, verse_id, unit_id, ord) VALUES (?,?,?,?)", (SOURCE, vid[(ch, vv)], uid, k))
    for ch, c in d["chapters"].items():
        con.execute("INSERT INTO study_chapters(source, chapter, data) VALUES (?,?,?)", (SOURCE, int(ch), json.dumps(c, ensure_ascii=False)))

    con.execute("DELETE FROM sources WHERE id = 'nirvikalpananda'")
    con.execute("INSERT INTO sources(id, name, license, attribution, url) VALUES (?,?,?,?,?)",
                ("nirvikalpananda", "Swami Nirvikalpananda, Srimad Bhagavad Gita (Telugu)",
                 "Free use (uploaded by the rights holder)", ATTRIBUTION, URL))
    con.execute("INSERT OR REPLACE INTO meta(key, value) VALUES ('study_sources', 'nirvikalpananda')")
    con.execute("INSERT INTO text_fts(text_fts) VALUES ('optimize')")
    con.commit()
    con.execute("VACUUM")
    con.close()
    print(f"texts: {n_texts}, units: {len(d['units'])}, verses: {len(d['verses'])}")


if __name__ == "__main__":
    main()
