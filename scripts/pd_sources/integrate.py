"""Add the digitised public-domain works to assets/db/gita.db and the app bundle.

  python3 scripts/pd_sources/integrate.py

Idempotent: removes and re-inserts authors 26 (Swami Swarupananda, 1909) and
27 (A. Mahadeva Sastri, 1901, Shankara's commentary). Only `high`/`medium`
confidence material from scripts/out/pd_sources/*.json is used; the *_low files
are never shipped. Remember to bump GITA_DB_VERSION in src/gita-data/db.js.
"""
import json
import os
import sqlite3

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "scripts", "out", "pd_sources")
DB = os.path.join(ROOT, "assets", "db", "gita.db")
WBW_ASSET = os.path.join(ROOT, "assets", "data", "wbw-swarupananda.json")
OK = {"high", "medium"}

AUTHORS = [
    (26, "Swami Swarupananda", "english", "both", "Advaita (Ramakrishna Order)", "1909",
     "Public domain",
     "Swami Swarupananda, Srimad Bhagavad Gita (Advaita Ashrama, Mayavati: Prabuddha Bharata Press, 1909). Digitised from archive.org in.ernet.dli.2015.386852.",
     "https://archive.org/details/in.ernet.dli.2015.386852", "Srimad Bhagavad Gita (1909)", 1),
    (27, "A. Mahadeva Sastri", "english", "both", "Advaita (translation of Śaṅkara)", "1901",
     "Public domain",
     "A. Mahadeva Sastri, The Bhagavad-Gita with the Commentary of Sri Sankaracharya, 2nd ed. (Mysore, 1901). Digitised from archive.org bhagavadgitawith00maharich.",
     "https://archive.org/details/bhagavadgitawith00maharich", "Bhagavad-Gita with the Commentary of Sri Sankaracharya (1901)", 1),
]


def para(text, label=None):
    b = {"type": "paragraph", "text": text.strip()}
    if label:
        b["label"] = label
    return b


def plain(blocks):
    return "\n\n".join(((b.get("label") + " — ") if b.get("label") else "") + b["text"] for b in blocks)


def main():
    con = sqlite3.connect(DB)
    vid = {f"{c}.{v}": i for i, c, v in con.execute("SELECT id, chapter, verse FROM verses")}
    old = [r[0] for r in con.execute("SELECT id FROM texts WHERE author_id IN (26, 27)")]
    # (first run: no rows yet; re-runs should start from a fresh gita.db build)
    con.execute("DELETE FROM texts WHERE author_id IN (26, 27)")
    con.execute("DELETE FROM authors WHERE id IN (26, 27)")
    con.executemany("INSERT INTO authors(id, name, lang, kind, tradition, era, license, attribution, source_url, work, public_domain) VALUES (?,?,?,?,?,?,?,?,?,?,?)", AUTHORS)

    rows = []  # (verse_id, verse_id_end, author_id, type, blocks)
    sw = json.load(open(os.path.join(OUT, "swarupananda_translation.json")))
    for k, v in sw.items():
        if k not in vid:
            continue
        if v.get("confidence") in OK and v.get("text"):
            rows.append((vid[k], vid[k], 26, "translation", [para(v["text"])]))
        if v.get("notes") and v.get("notes_confidence") in OK:
            rows.append((vid[k], vid[k], 26, "commentary", [para(p) for p in v["notes"].split("\n\n") if p.strip()]))

    ms = json.load(open(os.path.join(OUT, "mahadevasastri.json")))
    seen_ranges = set()
    for k, v in ms.items():
        if k not in vid:
            continue
        if v.get("translation") and v.get("translation_confidence", v.get("confidence")) in OK:
            rows.append((vid[k], vid[k], 27, "translation", [para(v["translation"])]))
        com = v.get("commentary") or []
        if com and v.get("commentary_confidence", v.get("confidence")) in OK:
            rng = v.get("range") or k
            if rng in seen_ranges:
                continue
            seen_ranges.add(rng)
            a, _, b = rng.partition("-")
            ch = a.split(".")[0]
            end = f"{ch}.{b}" if b else a
            blocks = []
            intro = v.get("introduction")
            if isinstance(intro, list):
                intro = " ".join(x for x in intro if x)
            if intro and intro.strip():
                blocks.append(para(intro, "Introduction"))
            blocks += [para(p) for p in com if p.strip()]
            rows.append((vid.get(a, vid[k]), vid.get(end, vid[k]), 27, "commentary", blocks))

    for verse_id, verse_end, author, typ, blocks in rows:
        body = json.dumps(blocks, ensure_ascii=False)
        pt = plain(blocks)
        cur = con.execute(
            "INSERT INTO texts(verse_id, verse_id_end, author_id, type, lang, body, word_count, placeholder) VALUES (?,?,?,?,?,?,?,0)",
            (verse_id, verse_end, author, typ, "english", body, len(pt.split())),
        )
        con.execute("INSERT INTO text_fts(rowid, plain) VALUES (?, ?)", (cur.lastrowid, pt))

    srcs = [
        ("swarupananda-1909", "Swami Swarupananda, Srimad Bhagavad Gita (1909)", "Public domain", AUTHORS[0][7], AUTHORS[0][8]),
        ("mahadevasastri-1901", "A. Mahadeva Sastri, Gita with Sankara's commentary (1901)", "Public domain", AUTHORS[1][7], AUTHORS[1][8]),
    ]
    con.execute("DELETE FROM sources WHERE id IN ('swarupananda-1909','mahadevasastri-1901')")
    con.executemany("INSERT INTO sources(id, name, license, attribution, url) VALUES (?,?,?,?,?)", srcs)
    con.execute("INSERT INTO text_fts(text_fts) VALUES ('optimize')")
    con.commit()
    con.execute("VACUUM")
    con.close()

    wbw = json.load(open(os.path.join(OUT, "swarupananda_wbw.json")))
    slim = {"source": wbw.get("source"), "license": wbw.get("license"), "verses": {}}
    for k, v in wbw["verses"].items():
        if v.get("confidence") not in OK:
            continue
        words = [{"term_dev": w["term_dev"], "term_iast": w.get("term_iast"), "meaning": w["meaning"]} for w in v["words"] if w.get("term_dev") and w.get("meaning")]
        if words:
            slim["verses"][k] = {"confidence": v["confidence"], "words": words}
    os.makedirs(os.path.dirname(WBW_ASSET), exist_ok=True)
    json.dump(slim, open(WBW_ASSET, "w"), ensure_ascii=False, separators=(",", ":"))

    print(f"texts inserted: {len(rows)} (swarupananda tr/notes + sastri tr/commentary)")
    print(f"word-by-word verses bundled: {len(slim['verses'])}")


if __name__ == "__main__":
    main()
