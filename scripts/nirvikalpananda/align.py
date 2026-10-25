"""Map the book's sloka lines onto the verses of gita.db.

The book sometimes prints half a verse with the next one (1.20–21, 1.26–31, …) and
numbers Arjuna's question in chapter 13 as 0, so verses are matched by text, not by
number: every printed line is transliterated to Devanagari, normalised like
db.js normDeva, and aligned with the chapter's verses from gita.db.
"""
import difflib
import json
import os
import re
import sqlite3

from indic_transliteration import sanscript

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DB = os.path.join(ROOT, "assets", "db", "gita.db")

VIRAMA = "्"
CONS = re.compile(r"[क-ह]")
INDEP_TO_MATRA = {"अ": "", "आ": "ा", "इ": "ि", "ई": "ी", "उ": "ु", "ऊ": "ू", "ऋ": "ृ", "ॠ": "ॄ", "ए": "े", "ऐ": "ै", "ओ": "ो", "औ": "ौ"}


def te2dev(s):
    return sanscript.transliterate(s, sanscript.TELUGU, sanscript.DEVANAGARI)


def norm_dev(s):
    """Comparison form, same rules as db.js normDeva plus the book's spelling habits."""
    s = re.sub(r"⁽\d+⁾", "", s)
    a = list(s)
    out = []
    i = 0
    while i < len(a):
        c = a[i]
        if re.match(r"[\s।॥|:.,\-‌‍ऽ0-9०-९‘’'\"()!?;]", c):
            i += 1
            continue
        if c in "ङञणनम" and i + 1 < len(a) and a[i + 1] == VIRAMA:
            j = i + 2
            while j < len(a) and a[j] == " ":
                j += 1
            if (j < len(a) and CONS.match(a[j])) or (c == "म" and j >= len(a)):
                out.append("ं")
                i += 2
                continue
        if CONS.match(c) and i + 1 < len(a) and a[i + 1] == VIRAMA:
            j = i + 2
            while j < len(a) and a[j] == " ":
                j += 1
            if j < len(a) and a[j] in INDEP_TO_MATRA:
                out.append(c + INDEP_TO_MATRA[a[j]])
                i = j + 1
                continue
        out.append("ं" if c == "ँ" else c)
        i += 1
    t = "".join(out)
    t = t.replace("त्त्र", "त्र")  # the book doubles t before r (పుత్త్ర)
    return t


def db_chapter(ch):
    con = sqlite3.connect(DB)
    rows = con.execute("SELECT id, verse, speaker, lines_json FROM verses WHERE chapter = ? ORDER BY verse", (ch,)).fetchall()
    return [{"id": r[0], "verse": r[1], "speaker": r[2], "lines": json.loads(r[3])} for r in rows]


def align_lines(book_lines, db_verses):
    """book_lines: [Telugu text]. Returns [verse number] per book line and per-verse
    similarity {verse: ratio} of the reassembled book text against gita.db."""
    bn = [norm_dev(te2dev(t)) for t in book_lines]
    dn = [norm_dev(" ".join(v["lines"])) for v in db_verses]
    B = "".join(bn)
    D = "".join(dn)
    owner = []
    for k, s in enumerate(dn):
        owner += [k] * len(s)
    sm = difflib.SequenceMatcher(None, B, D, autojunk=False)
    bmap = [None] * len(B)
    for a, b, n in sm.get_matching_blocks():
        for x in range(n):
            bmap[a + x] = owner[b + x]
    result = []
    pos = 0
    for s in bn:
        votes = [bmap[pos + x] for x in range(len(s)) if bmap[pos + x] is not None]
        pos += len(s)
        result.append(db_verses[max(set(votes), key=votes.count)]["verse"] if votes else None)
    return result, dn
