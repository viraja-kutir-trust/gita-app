"""Parse the decoded Nirvikalpananda chapters into a verse dataset.

  scripts/.venv/bin/python scripts/nirvikalpananda/parse.py

Layout of one unit (one verse, or a group such as 1.4–6 that shares a translation):

  [speaker line]            Priyaanka 15     "ధృతరాష్ట్ర ఉవాచ :"
  sloka lines               PriyaankaBold 18 last line ends "॥ N"
  padaccheda lines          Priyaanka 15/16  "ధర్మక్షేత్రే, కురుక్షేత్రే, …"
  (repeated for each verse of a group)
  word-by-word              Gowthami 14, two columns (bold term "= meaning;"),
                            read column 1 top to bottom, then column 2, page by page
  translation               "తా॥ …" Priyaanka 16, ends with the verse number ("4–6")
  footnotes                 Priyaanka 12/13 at the page foot, "1. …", numbered per page

Footnote markers (⁽n⁾) refer to the note with that number on the same page; in the
output each unit's notes are renumbered 1, 2, … in reading order.

Writes scripts/nirvikalpananda/dataset/nirvikalpananda.json and parse_report.md.
"""
import json
import os
import re
import sys
from collections import defaultdict

from anu import decode
from align import align_lines, db_chapter, norm_dev, te2dev
from lines import Run, load_pages, page_lines

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, "dataset")
COL_SPLIT = 192.0       # x between the two word-by-word columns
PARA_INDENT = 66.0      # translation lines starting right of this open a paragraph
MARK = re.compile(r"⁽(\d+)⁾")
NUM_END = re.compile(r"\s*(\d+)(?:\s*[–-]\s*(\d+))?\.?((?:⁽\d+⁾)*)\s*$")
# Book verse numbers that differ from the standard (gita.db) numbering.
# Chapter 13: the book numbers Arjuna's question "prakṛtiṃ puruṣaṃ caiva…" as 0.
OFFSET = {13: 1}


def main_font(line):
    """(font, size) carrying most of the line's visible glyphs."""
    w = defaultdict(int)
    for sp in line.spans:
        w[(sp["font"], sp["size"])] += len(sp["text"].strip())
    return max(w, key=w.get) if w else ("", 0)


def kind_of(line, page_no):
    t = line.text().strip()
    if not t:
        return "blank"
    font, size = main_font(line)
    fonts = line.fonts
    if line.oy < 62 and (any(f.startswith(("Pragathi", "Times")) for f in fonts)):
        return "header"
    if any(f.startswith(("Kranthi", "PallaviBold")) for f in fonts):
        return "title"
    if t.startswith("॥ ఓమ్ నమో") or t.startswith("॥ ఓం నమో"):
        return "title"
    if len(t) <= 3 and not re.search(r"\d", t):
        return "blank"  # a stray glyph (e.g. a lone క్ష from a pasted symbol)
    if t.startswith("తా॥") and size > 13.6:
        return "trans"
    if font.startswith("Gowthami") and 13.2 <= size <= 14.6:
        return "wbw"
    if size <= 13.6:
        return "small"
    if font == "PriyaankaBold" and size >= 15.5:
        return "sloka"
    if size <= 14.5:
        return "p14"
    if re.search(r"వాచ\s*:?\s*$", t) or re.search(r"వాచ\s*:", t):  # ఉవాచ, భగవానువాచ
        return "speaker"
    return "text"


class Unit:
    """Slokas that share one word-by-word list and one translation."""

    def __init__(self):
        self.blocks = []        # [{speaker, lines: [(page, text, num)], pad: [(page, text)]}]
        self.wbw = []           # [(page, col, oy, [(bold, text)])]
        self.trans = []         # [(page, line)]
        self.preface = []       # [(page, line)] printed between the words and "తా॥"
        self.extra = []         # [(page, line)] paragraphs printed after the closing number
        self.trans_done = False
        self.label = None       # the book's verse number(s) closing the translation

    @property
    def stage(self):
        if self.trans:
            return "trans"
        if self.wbw:
            return "wbw"
        return "sloka"

    @property
    def nums(self):
        return [n for b in self.blocks for _, _, n in b["lines"] if n is not None]


def wbw_chunks(line):
    """Split a word-by-word line into (col, bold, text) chunks, markers inline."""
    out = []
    for r in line.runs:
        if not r.font.startswith("Gowthami"):
            continue
        # split at the first word that starts right of the column gap
        cut = len(r.glyphs)
        for i, (c, x) in enumerate(r.glyphs):
            if c.strip() and x >= COL_SPLIT and (i == 0 or not r.glyphs[i - 1][0].strip()):
                cut = i
                break
        for col in (0, 1):
            gl = r.glyphs[:cut] if col == 0 else r.glyphs[cut:]
            if not "".join(c for c, _ in gl).strip():
                continue
            sub = Run(r.font, r.size, gl)
            lo = min(x for c, x in gl if c.strip())
            hi = max(x for c, x in gl) + 8
            ms = [(x, n) for x, n in line.markers if lo - 8 <= x <= hi + 20 and (x < COL_SPLIT + 4) == (col == 0)]
            out.append((col, r.bold, line.run_text(sub, ms), lo))
    return out


def parse_wbw(rows):
    """rows: [(page, col, oy, [(bold, text)])] in reading order -> [{term, meaning}].

    A term is set bold and followed by "= meaning;". Meanings run on to the next
    line; a few terms are set in the thin face ("(ఇతి = అని;)"), and 10.34 pairs
    bold terms with thin meanings on alternate half-lines without "=".
    """
    entries = []  # {"term": [..], "mean": [..], "eq": bool}

    def new(term, mean="", eq=False):
        entries.append({"term": [term] if term else [], "mean": [mean] if mean else [], "eq": eq})

    for _, _, _, chunks in rows:
        for bold, text in chunks:
            text = text.replace("\u00a0", " ")
            if bold:
                last = entries[-1] if entries else None
                if "=" in text:
                    t, m = text.split("=", 1)
                    if last and last["term"] and not last["eq"] and not last["mean"]:
                        last["term"].append(t)
                        last["mean"].append(m)
                        last["eq"] = True
                    else:
                        new(t, m, True)
                elif last and last["term"] and not last["eq"] and not last["mean"]:
                    last["term"].append(text)  # a long term set over two lines
                else:
                    new(text)
                continue
            for piece in re.split(r"(?<=;)", text):
                st = piece.strip()
                if not st:
                    continue
                last = entries[-1] if entries else None
                if last and not last["eq"] and not last["mean"] and st.startswith("="):
                    last["eq"] = True
                    last["mean"].append(st[1:])
                elif last and last["term"] and not last["eq"] and not last["mean"] and "=" in st:
                    t, m = st.split("=", 1)  # the term's last word set thin: "సంస్మృత్య సంస్మృత్య" + "చ = …"
                    last["term"].append(t)
                    last["mean"].append(m)
                    last["eq"] = True
                elif "=" in st and not st.startswith("=") and (not last or last["eq"] or last["mean"]):
                    t, m = st.split("=", 1)
                    new(t, m, True)  # a term set in the thin face
                elif last:
                    last["mean"].append(piece)
                else:
                    new(st)
    out = []
    for e in entries:
        term = re.sub(r"\s+", " ", " ".join(e["term"])).strip()
        meaning = re.sub(r"\s+", " ", " ".join(e["mean"])).strip()
        meaning = re.sub(r"^=\s*", "", meaning)
        meaning = re.sub(r"\s*;\s*$", "", meaning)
        meaning = re.sub(r"\s+([;,.?!)])", r"\1", meaning)
        implied = False
        if term.startswith("(") and meaning.endswith(")") and ")" not in term:
            # "(అస్య = దీని;)": a word the reader supplies, printed in brackets
            term = term[1:].strip()
            meaning = re.sub(r"[\s;]*\)$", "", meaning).strip()
            implied = True
        notes = [int(n) for n in MARK.findall(term)]
        term = MARK.sub("", term).strip().rstrip(",").strip()
        item = {"term": term, "meaning": meaning}
        if not term or not meaning:
            item["_bad"] = True
        if implied:
            item["implied"] = True
        if notes:
            item["term_notes"] = notes
        out.append(item)
    return out


def fix_words(ch, vs, words):
    """Layouts the column parser cannot read, fixed by hand from the scan."""
    if (ch, vs) == (10, [34]):
        # Seven nouns stacked in a bracket with one "=" and their meanings beside them.
        k = next(i for i, w in enumerate(words) if w["term"].startswith("కీర్తిః"))
        tail = [w for w in words[k + 3:]]
        # "(ధర్ముని సపత్నులైన)" printed above the bracket introduces the seven names.
        prev = words[k - 1]
        lead = ""
        if prev["meaning"].endswith("(ధర్ముని సపత్నులైన)"):
            prev["meaning"] = prev["meaning"][: -len("(ధర్ముని సపత్నులైన)")].rstrip(" ;")
            lead = "(ధర్ముని సపత్నులైన) "
        words = words[:k] + [{
            "term": "కీర్తిః, శ్రీః, వాక్, స్మృతిః, మేధా, ధృతి, క్షమా చ",
            "meaning": lead + "కీర్తి, శ్రీ, వాక్కు, స్మృతిః, మేధా, ధృతి, క్షమ అయి ఉన్నాను.",
        }] + tail
    return words


def clean_pad(lines):
    # a printed line ends between two words even when the book left out the comma
    s = " ".join(l.strip() + ("" if re.search(r"[,.।]\s*$", l.strip()) or i == len(lines) - 1 else ",") for i, l in enumerate(lines))
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s*,\s*", ", ", s)
    s = re.sub(r"[.।]\s*$", "", s).strip()
    return s


def sloka_line(t):
    t = re.sub(r"\s+", " ", t).strip()
    return t


def join_para(lines):
    s = ""
    for l in lines:
        l = l.strip()
        if not s:
            s = l
        elif s.endswith("-") and not s.endswith(" -"):
            s = s[:-1] + l
        else:
            s += " " + l
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([,.;?!:)’])", r"\1", s)
    s = re.sub(r"(⁾)\s+([,.;?!])", r"\1\2", s)
    return s.strip()


def parse_chapter(ch, report):
    pages = load_pages(ch)
    units, cur = [], None
    notes = defaultdict(dict)       # page -> {n: [lines]}
    intro, colophon, epilogue = [], [], []
    title = None
    seen_sloka = False
    last_note = None                # (page, n): a note may run on to the next page's foot
    pending_speaker = None
    pending_preface = []            # a bracketed lead-in printed between a speaker and the sloka
    last_num = -1

    for pno, spans in enumerate(pages):
        lines = page_lines(spans)
        kinds = [kind_of(l, pno) for l in lines]
        body_idx = [i for i, k in enumerate(kinds) if k in ("sloka", "wbw", "trans", "text", "speaker")]
        last_body = max(body_idx) if body_idx else -1
        page_notes = notes[pno]
        for i, (l, k) in enumerate(zip(lines, kinds)):
            t = l.text()
            if k in ("header", "blank"):
                continue
            if k == "title":
                if re.search(r"ధ్యాయః", t) and title is None:
                    title = re.sub(r"\s+", " ", t).strip()
                continue
            # page foot: footnotes (small type after the last body line)
            if i > last_body and (k == "small" or (k == "p14" and re.match(r"^\s*\d+\s*\.", t))):
                # two short notes may share a line: "1. …      2. …"
                parts = re.split(r"\s{3,}(?=\d+\s*\.\s)", t)
                for part in parts:
                    if not part.strip():
                        continue
                    m = re.match(r"^\s*(\d+)\s*\.\s*(.*)$", part)
                    n = int(m.group(1)) if m else 0
                    expected = (max(page_notes) + 1) if page_notes else None
                    # Numbering usually restarts on each page, but it can continue from the
                    # previous page (4.24) and a page may first finish the previous page's
                    # notes (13.2: "3.", "4." then its own "1.")
                    if m and n <= 30 and (expected is None or n == expected or (n == 1 and 1 not in page_notes)):
                        page_notes[n] = [m.group(2)]
                        last_note = (pno, n)
                    elif page_notes and last_note and last_note[0] == pno:
                        page_notes[last_note[1]].append(part)
                    elif last_note:
                        notes[last_note[0]][last_note[1]].append(part)
                        report.append(f"- {ch}: note {last_note[1]} of page {last_note[0] + 1} runs on to page {pno + 1}")
                    else:
                        report.append(f"- {ch} p{pno + 1}: stray small line {part!r}")
                continue
            if k == "small" and i < last_body and cur and cur.stage in ("wbw", "trans") and not cur.trans_done:
                # translation text set smaller to fit the page (2.45), or a bracketed
                # lead-in printed before "తా॥" (2.11)
                if cur.stage == "wbw":
                    cur.preface.append((pno, l))
                    continue
                k = "text"
            if k in ("text", "p14") and cur and cur.stage == "wbw" and not cur.trans_done:
                cur.preface.append((pno, l))  # e.g. "మరొక అన్వయం :" after 14.27's words
                continue
            if not seen_sloka and k in ("text", "p14", "small"):
                intro.append((pno, l))
                continue
            if k == "speaker" and not colophon:
                pending_speaker = re.sub(r"\s*:\s*$", "", t).strip()
                continue
            if k == "sloka":
                seen_sloka = True
                if cur is None or cur.stage != "sloka" or cur.trans_done:
                    cur = Unit()
                    units.append(cur)
                    cur.preface, pending_preface = pending_preface, []
                if not cur.blocks or cur.blocks[-1]["pad"] or pending_speaker:
                    cur.blocks.append({"speaker": pending_speaker, "lines": [], "pad": []})
                    pending_speaker = None
                num = None
                m = re.search(r"॥\s*(\d+)\s*$", t)
                if m:
                    num = int(m.group(1))
                    t = t[: m.start(1)].rstrip()
                    last_num = max(last_num, num)
                cur.blocks[-1]["lines"].append((pno, re.sub(r"\s+", " ", t).strip(), num))
                continue
            if k in ("text", "p14") and cur and cur.stage == "sloka" and cur.blocks and not cur.trans_done:
                cur.blocks[-1]["pad"].append((pno, t))
                continue
            if k == "wbw":
                if cur is None or cur.trans_done or cur.stage == "trans":
                    report.append(f"- {ch} p{pno + 1}: word-by-word line outside a unit: {t!r}")
                    continue
                chunks = wbw_chunks(l)
                for col in (0, 1):
                    cc = [(b, tx) for c, b, tx, _ in chunks if c == col]
                    if cc:
                        cur.wbw.append((pno, col, l.oy, cc))
                continue
            if k == "trans" or (k in ("text", "p14") and cur and cur.stage == "trans" and not cur.trans_done):
                if cur is None:
                    report.append(f"- {ch} p{pno + 1}: translation without verse: {t!r}")
                    continue
                if k == "trans" and (cur.trans_done or not cur.blocks):
                    colophon.append((pno, l))
                    continue
                cur.trans.append((pno, l))
                m = NUM_END.search(t)
                if m:
                    end = int(m.group(2) or m.group(1))
                    start = int(m.group(1))
                    own = cur.nums
                    lo = own[0] if own else last_num + 1
                    if (own and end == own[-1] or last_num <= end <= last_num + 2) and start <= end and start >= lo - 1 and (t[: m.start()].strip() or len(cur.trans) > 1):
                        cur.trans_done = True
                        cur.label = (m.group(1) + ("–" + m.group(2) if m.group(2) else ""))
                continue
            if cur and cur.trans_done and not colophon and k == "text" and not re.match(r"^\s*ఇతి\s", t):
                if pending_speaker:
                    pending_preface.append((pno, l))
                else:
                    cur.extra.append((pno, l))  # a further paragraph after the translation (2.69)
                continue
            if cur and cur.trans_done and (k in ("text", "p14", "small", "trans", "speaker")):
                if k == "speaker" and colophon:
                    colophon.append((pno, l))
                    continue
                colophon.append((pno, l))  # chapter close: colophon, verse count, closing verses
                continue
            report.append(f"- {ch} p{pno + 1}: unplaced {k} line {t!r}")

    for u in units:
        if not u.trans_done:
            report.append(f"- {ch}: unit {[b['lines'][0][1][:30] for b in u.blocks]} has no closing verse number")
    return {"title": title, "units": units, "notes": notes, "intro": intro, "colophon": colophon, "epilogue": epilogue}


def resolve_notes(texts_with_pages, notes, report, where):
    """Renumber ⁽n⁾ markers 1, 2, … in reading order; return (new texts, footnotes)."""
    mapping, foot = {}, []
    taken = set()

    def sub(page):
        def f(m):
            key = (page, int(m.group(1)))
            if key not in mapping:
                body = notes.get(page, {}).get(key[1])
                if body is None and key[1] in notes.get(page + 1, {}) and (page + 1, key[1]) not in taken:
                    # the last notes of a chapter are set on the following page
                    key = (page + 1, key[1])
                    body = notes[page + 1][key[1]]
                    report.append(f"- {where}: note {key[1]} found on the next page ({page + 2})")
                if key in mapping:
                    return f"⁽{mapping[key]}⁾"
                if body is None:
                    report.append(f"- {where}: marker {key[1]} on page {page + 1} has no footnote")
                    return ""
                mapping[key] = len(foot) + 1
                foot.append({"n": mapping[key], "text": note_text(body)})
            return f"⁽{mapping[key]}⁾"
        return f

    out = []
    for page, text in texts_with_pages:
        out.append(MARK.sub(sub(page), text))
    return out, foot, mapping


def note_text(lines):
    """Join footnote lines: verse quotes (ending in । or ॥) keep their line breaks."""
    s = ""
    for l in lines:
        l = re.sub(r"\s+", " ", l).strip()
        if not l:
            continue
        if not s:
            s = l
        elif re.search(r"[।॥]\s*$", s) or re.search(r"^[(]\S{1,2}[)]", l):
            s += "\n" + l
        else:
            s += " " + l
    s = re.sub(r"\s+([,.;?!:)’])", r"\1", s)
    return s.strip()


def build(ch, parsed, report, used_notes):
    db = db_chapter(ch)
    units = parsed["units"]
    flat = [(ui, bi, li) for ui, u in enumerate(units) for bi, b in enumerate(u.blocks) for li in range(len(b["lines"]))]
    texts = [units[ui].blocks[bi]["lines"][li][1] for ui, bi, li in flat]
    owners, _ = align_lines(texts, db)
    line_verse = dict(zip(flat, owners))
    # sanity: a printed verse number must close the verse it was aligned to
    for (ui, bi, li), v in line_verse.items():
        num = units[ui].blocks[bi]["lines"][li][2]
        if num is not None and v is not None and num + OFFSET.get(ch, 0) != v:
            report.append(f"- {ch}: line numbered {num} aligned to verse {v}: {texts[flat.index((ui, bi, li))]!r}")
    out_units = {}
    unit_pages = {}
    verse_units = defaultdict(list)
    for ui, u in enumerate(units):
        vs = sorted({line_verse[(ui, bi, li)] for bi, b in enumerate(u.blocks) for li in range(len(b["lines"])) if line_verse[(ui, bi, li)] is not None})
        if not vs:
            report.append(f"- {ch}: unit {ui} matched no verse")
            continue
        # reading order: sloka, padaccheda, words, translation
        seq = []
        for b in u.blocks:
            seq += [(p, t) for p, t, _ in b["lines"]]
            seq += [(p, t) for p, t in b["pad"]]
        wb_rows = sorted(u.wbw, key=lambda r: (r[0], r[1], r[2]))
        words_pages = [(r[0], tx) for r in wb_rows for _, tx in r[3]]
        trans_lines = [(p, l.text()) for p, l in u.trans + u.extra]
        pre_lines = [(p, l.text()) for p, l in u.preface]
        renum, foot, mapping = resolve_notes(seq + words_pages + pre_lines + trans_lines, parsed["notes"], report, f"{ch}.{vs}")
        used_notes.update(mapping)
        new_seq = renum[: len(seq)]
        new_words = renum[len(seq): len(seq) + len(words_pages)]
        new_pre = renum[len(seq) + len(words_pages): len(seq) + len(words_pages) + len(pre_lines)]
        new_trans = renum[len(seq) + len(words_pages) + len(pre_lines):]
        it = iter(new_words)
        rows = [(r[0], r[1], r[2], [(b, next(it)) for b, _ in r[3]]) for r in wb_rows]
        words = parse_wbw(rows)
        for w in words:
            if w.get("_bad"):
                report.append(f"- {ch}.{vs}: incomplete word-by-word entry: {w!r}")
        words = [{kk: vv for kk, vv in w.items() if kk != "_bad"} for w in words]
        words = fix_words(ch, vs, words)
        paras, curp = [], []
        n_main = len(u.trans)
        for i, ((p, l), t) in enumerate(zip(u.trans + u.extra, new_trans)):
            # a paragraph opens indented (~80); a reference set flush right is not one
            if curp and ((PARA_INDENT < l.x0 < 110) or i == n_main):
                paras.append(curp)
                curp = []
            curp.append(t)
        if curp:
            paras.append(curp)
        paras = [join_para(p) for p in paras]
        if paras:
            paras = [re.sub(r"^తా॥\s*", "", x) for x in paras]
            nums = set(u.nums) | {n + 1 for n in u.nums} | ({int(u.label.split("–")[-1])} if u.label else set())

            def strip_num(x):
                m = NUM_END.search(x)
                if m and int(m.group(2) or m.group(1)) in nums and x[: m.start()].strip():
                    return (x[: m.start()].rstrip() + (m.group(3) or "")).rstrip()
                return x
            paras = [strip_num(x) for x in paras]
        blocks, k = [], 0
        for b in u.blocks:
            ln = new_seq[k: k + len(b["lines"])]
            k += len(b["lines"])
            pd = new_seq[k: k + len(b["pad"])]
            k += len(b["pad"])
            bverses = [line_verse[(ui, u.blocks.index(b), li)] for li in range(len(b["lines"]))]
            blk = {"lines": ln, "verses": bverses, "padaccheda": clean_pad(pd)}
            if b["speaker"]:
                blk["speaker"] = b["speaker"]
            blocks.append(blk)
        uid = f"{ch}.{vs[0]}" + (f"-{vs[-1]}" if len(vs) > 1 else "")
        if uid in out_units:
            uid += "b"
        unit_pages[uid] = {p for b in u.blocks for p, _, _ in b["lines"]} | {r[0] for r in u.wbw} | {p for p, _ in u.trans + u.extra}
        out_units[uid] = {
            "chapter": ch,
            "verses": vs,
            "label": u.label,
            "blocks": blocks,
            "words": words,
            "translation": paras,
            **({"preface": [re.sub(r"\s+", " ", t).strip() for t in new_pre]} if new_pre else {}),
            "footnotes": foot,
        }
        for v in vs:
            verse_units[f"{ch}.{v}"].append(uid)
    missing = [v["verse"] for v in db if f"{ch}.{v['verse']}" not in verse_units]
    if missing:
        report.append(f"- {ch}: verses with no unit: {missing}")
    return out_units, dict(verse_units), unit_pages


def chapter_extras(ch, parsed, report):
    """Chapter intro verse (with its notes), colophon and epilogue."""
    def lines_of(items):
        return [(p, l.text()) for p, l in items]
    intro = lines_of(parsed["intro"])
    renum, foot, mapping = resolve_notes(intro, parsed["notes"], report, f"{ch} intro")
    out = {"title": parsed["title"]}
    if renum:
        out["intro"] = [re.sub(r"\s+", " ", t).strip() for t in renum]
        if foot:
            out["intro_footnotes"] = foot
    if parsed["colophon"]:
        col = lines_of(parsed["colophon"])
        renum, foot, m3 = resolve_notes(col, parsed["notes"], report, f"{ch} closing")
        mapping = {**mapping, **m3}
        out["colophon"] = [re.sub(r"\s+", " ", t).strip() for t in renum]
        if foot:
            out["colophon_footnotes"] = foot
    if parsed["epilogue"]:
        ep = lines_of(parsed["epilogue"])
        renum, foot, m2 = resolve_notes(ep, parsed["notes"], report, f"{ch} epilogue")
        mapping = {**mapping, **m2}
        out["epilogue"] = [re.sub(r"\s+", " ", t).strip() for t in renum]
        if foot:
            out["epilogue_footnotes"] = foot
    return out, mapping


def main():
    os.makedirs(OUT, exist_ok=True)
    report = []
    data = {
        "source": "Swami Nirvikalpananda, Srimad Bhagavad Gita (Telugu): word-by-word meaning, padaccheda and translation with footnotes. "
                  "Digitised from the publisher's PDFs at archive.org/details/geeta-telugu-with-word2word-meaning-and-translation "
                  "(uploaded by the rights holder for free use; Public Domain Mark).",
        "license": "Public domain (archive.org Public Domain Mark 1.0; uploaded by the rights holder for free use)",
        "script": "telugu",
        "chapters": {},
        "verses": {},
    }
    data["units"] = {}
    for ch in range(1, 19):
        parsed = parse_chapter(ch, report)
        used = set()
        units, vmap, unit_pages = build(ch, parsed, report, used)
        extras, intro_map = chapter_extras(ch, parsed, report)
        used.update(intro_map)
        for page, ns in parsed["notes"].items():
            for n in sorted(ns):
                if (page, n) in used:
                    continue
                # the book printed this note without a marker: keep it with the verse on that page
                on_page = [uid for uid, pg in unit_pages.items() if page in pg]
                target = units[on_page[-1]]["footnotes"] if on_page else extras.setdefault("colophon_footnotes", [])
                target.append({"n": len(target) + 1, "text": note_text(ns[n]), "unanchored": True})
                report.append(f"- {ch} p{page + 1}: footnote {n} has no marker in the book; kept with {on_page[-1] if on_page else 'the chapter close'}")
        data["chapters"][str(ch)] = extras
        data["units"].update(units)
        data["verses"].update({k: {"units": v} for k, v in vmap.items()})
        print(ch, len(units), len(vmap), file=sys.stderr)
    with open(os.path.join(OUT, "nirvikalpananda.json"), "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "parse_report.md"), "w") as f:
        f.write("# Nirvikalpananda parse report\n\n" + "\n".join(report) + "\n")
    print(f"{len(data['units'])} units, {len(data['verses'])} verses, {len(report)} report lines", file=sys.stderr)


if __name__ == "__main__":
    main()
