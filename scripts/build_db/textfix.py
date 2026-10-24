"""Typographic normalisation + block structuring for translations/commentaries.

Rules (never reword an author's text):
  * whitespace, paragraph/line breaks, punctuation spacing, dandas, quotes,
    dashes, ellipses, mechanical Devanagari encoding typos, scraped junk.
  * every non-whitespace change is counted per author/category with samples
    (Fixer.log) and written to scripts/out/text_cleanup_report.md.

Block model (texts.body is a JSON array of these):
  {"type": "paragraph", "text": str, "label"?: str}
  {"type": "heading", "text": str}
  {"type": "verse_quote", "lines": [str], "text": str, "ref"?: str, "meter"?: str}
  {"type": "footnote", "text": str, "ref": str}       (none in the current data, see report)
Inline markup inside "text": ⟦…⟧ = pratīka / quoted word of the verse being
explained (UI renders bold). No other markup.
"""
import html
import re
import unicodedata
from collections import Counter, defaultdict

import deva as D

PRATIKA_OPEN, PRATIKA_CLOSE = "⟦", "⟧"
DEV = "\u0900-\u097f"
DEVL = "\u0900-\u0963\u0966-\u097f"  # Devanagari without the dandas
LAT = "A-Za-zÀ-ɏḀ-ỿ"


class Fixer:
    """Counts + samples of every change, per author and category."""

    def __init__(self, max_samples=4):
        self.counts = defaultdict(Counter)
        self.samples = defaultdict(lambda: defaultdict(list))
        self.max = max_samples
        self.author = None
        self.entry_score = 0

    def log(self, cat, before="", after="", n=1):
        if n <= 0:
            return
        self.counts[self.author][cat] += n
        self.entry_score += n
        s = self.samples[self.author][cat]
        if len(s) < self.max and (before or after):
            s.append((before[:160], after[:160]))

    def sub(self, cat, rx, rep, text, flags=0, ctx=20):
        """re.sub that logs each replacement with context."""
        if isinstance(rx, str):
            rx = re.compile(rx, flags)
        out, last, n = [], 0, 0
        for m in rx.finditer(text):
            r = m.expand(rep) if isinstance(rep, str) else rep(m)
            if r == m.group(0):
                continue
            out.append(text[last:m.start()])
            out.append(r)
            last = m.end()
            n += 1
            if len(self.samples[self.author][cat]) < self.max:
                a = text[max(0, m.start() - ctx):m.end() + ctx]
                b = text[max(0, m.start() - ctx):m.start()] + r + text[m.end():m.end() + ctx]
                self.samples[self.author][cat].append((a, b))
        if not n:
            return text
        out.append(text[last:])
        self.counts[self.author][cat] += n
        self.entry_score += n
        return "".join(out)


# ------------------------------------------------------------------ patterns
PREFIX_RE = re.compile(
    r"^\s*(?:[।|॥]+\s*)?\d{1,2}\s*[.।]\s*\d{1,3}"
    r"(?:\s*(?:--|-|–|,|&|to|\s)\s*(?:\d{1,2}\s*[.।]\s*)?\d{1,3})*"
    r"\s*\.?\s*(?:[।|॥]+)?\s*\.?\s*(?:--,?\s*)?"
)
PREFIX_SHORT_RE = re.compile(r"^\s*\d{1,3}\s*[।|]{2}\s*")
HI_QWORDS = re.compile(r"(क्या|क्यों|क्यूँ|कैसे|कैसा|कैसी|कौन|किस|किन|कहाँ|कहां|कब|कितन)")
PLACEHOLDER_RE = re.compile(r"(^(Hindi|Sanskrit|English) (Commentary|Translation) By|did not comment|"
                            r"See Commentary under|commentary starts from|No commentary)", re.I)
ENC_RULES = [
    (r"([क-ह])्ि([क-ह])", r"\1्\2ि", "deva: i-matra typed before conjunct consonant"),
    (r"([क-ह])ि्([क-ह])", r"\1्\2ि", "deva: i-matra typed before virama"),
    ("ृ़", "ॄ", "deva: ṝ encoded as ृ + nukta"),
    (r"([ािीुूृेैोौ])\1", r"\1", "deva: doubled vowel sign"),
    (r"([ंःँ])\1", r"\1", "deva: doubled anusvara/visarga"),
]
RAMSUKHDAS_HEADINGS = ["परिशिष्ट भाव", "सम्बन्ध", "व्याख्या", "विशेष बात", "मार्मिक बात"]
RAMSUKHDAS_LABELS = ["शङ्का", "समाधान", "प्रश्न", "उत्तर"]
ITI_TAIL = r"(?:इति|िति|ेति|ीति|इत्यादि(?:ना)?|ेत्यादि(?:ना)?|ीत्यादि(?:ना)?|ित्यादि(?:ना)?)"


# ------------------------------------------------------------------ helpers
def strip_prefix(t, fx):
    m = PREFIX_RE.match(t) or PREFIX_SHORT_RE.match(t)
    if m and m.end() > 0 and m.group(0).strip():
        fx.log("junk: leading verse-number prefix", m.group(0), "")
        return t[m.end():]
    return t


def fix_question_marks(text, lang, fx):
    """The supersite export replaced commas with '?'. Restore them (heuristic per language)."""
    if "?" not in text:
        return text
    out = []
    for i, ch in enumerate(text):
        if ch != "?":
            out.append(ch)
            continue
        prev = text[i - 1:i]
        nxt_ch = text[i + 1:i + 3].strip()[:1]
        at_end = not text[i + 1:].strip() or text[i + 1:i + 2] == "\n"
        if prev.isdigit() and text[i + 1:i + 2].isdigit():
            rep = ","  # 4?320?000 -> 4,320,000
        elif lang == "sanskrit":
            rep = "," if not at_end else "?"
        elif lang == "english":
            rep = "," if nxt_ch and (nxt_ch.islower() or "ऀ" <= nxt_ch <= "ॿ") else "?"
        elif lang == "hindi":
            start = max(text.rfind("।", 0, i), text.rfind("?", 0, i), text.rfind("\n", 0, i), text.rfind("!", 0, i))
            rep = "?" if at_end or HI_QWORDS.search(text[start + 1:i]) else ","
        else:
            rep = "?"
        if rep != "?":
            fx.log("punct: '?' restored to ',' (export artifact)", text[max(0, i - 15):i + 10],
                   text[max(0, i - 15):i] + rep + text[i + 1:i + 10])
        out.append(rep)
    return "".join(out)


def smart_quotes(t, fx):
    """Straight quotes -> curly. Stateful per paragraph so that a misplaced
    closing quote ("'कूर्म 'नामक") is recognised. Apostrophes inside Latin
    words -> ’ (not counted as quotes)."""
    if "'" not in t and '"' not in t:
        return t
    t = fx.sub("quotes: apostrophe", r"(?<=[%s])'(?=[%s])" % (LAT, LAT), "’", t)
    out = list(t)
    state = {"'": False, '"': False}
    OPEN = {"'": "‘", '"': "“"}
    CLOSE = {"'": "’", '"': "”"}
    depth = 0
    i = 0
    while i < len(out):
        ch = out[i]
        if ch not in ("'", '"'):
            i += 1
            continue
        prev = out[i - 1] if i else " "
        nxt = out[i + 1] if i + 1 < len(out) else " "
        looks_open = (prev in " ([{—–-/⟦" or i == 0) and not nxt.isspace()
        if ch == '"' and state[ch] and looks_open:
            # nested “…“…”…” (Tamil, English): open a second level
            out[i] = OPEN[ch]
            depth += 1
            fx.log("quotes: straight -> curly")
            i += 1
            continue
        if ch == '"' and depth and not looks_open:
            out[i] = CLOSE[ch]
            depth -= 1
            fx.log("quotes: straight -> curly")
            i += 1
            continue
        if state[ch]:
            if ch == "'" and looks_open and prev == " " and i > 0:
                # "'कूर्म 'नामक": closing quote typed after the space
                out[i - 1], out[i] = CLOSE[ch], " "
                fx.log("quotes: misplaced closing quote", "".join(t[max(0, i - 12):i + 8]), "")
            else:
                out[i] = CLOSE[ch]
                fx.log("quotes: straight -> curly")
            state[ch] = False
        else:
            if looks_open or not prev.isspace():
                out[i] = OPEN[ch] if looks_open else CLOSE[ch]
                state[ch] = looks_open
            else:
                out[i] = CLOSE[ch]
            fx.log("quotes: straight -> curly")
        i += 1
    t = "".join(out)
    t = fx.sub("space: after closing quote", r"(?<=[’”])(?=[%s])" % DEVL, " ", t)
    return t


def normalize_inline(t, lang, fx):
    """Typographic fixes inside one paragraph (no newlines)."""
    # whitespace
    t = re.sub(r"[    \t]+", " ", t).strip()
    # dashes
    t = fx.sub("dash: '--,' junk -> em dash", r"\s*--,\s*", " — ", t)
    t = fx.sub("dash: '--' -> em dash", r"\s*-{2,}\s*", " — ", t)
    t = fx.sub("dash: spaced hyphen -> em dash", r"(?<=\S) - (?=\S)", " — ", t)
    if lang == "english":
        t = fx.sub("dash: English em dash unspaced", r"(?<=[%s,;]) — (?=[%s])" % (LAT, LAT), "—", t)
    # ellipsis
    t = fx.sub("punct: ellipsis", r"\.\s?\.\s?\.", "…", t)
    # dandas
    t = fx.sub("danda: '।।' -> '॥'", r"।\s*।", "॥", t)
    t = fx.sub("danda: ASCII '||' -> '॥'", r"(?<=[%s\s])\|\|" % DEV, "॥", t)
    t = fx.sub("danda: ASCII '|' -> '।'", r"(?<=[%s\s])\|(?!\|)" % DEV, "।", t)
    # no space before danda / punctuation, one after
    t = re.sub(r"\s+([।॥,;:!?)\]])", r"\1", t)
    t = re.sub(r"([(\[])\s+", r"\1", t)
    t = fx.sub("punct: redundant comma before danda", r"[,;]\s*(?=[।॥])", "", t)
    t = fx.sub("punct: redundant danda after ?/!", r"(?<=[?!])\s*।(?!।)", "", t)
    t = fx.sub("danda: '॥ ।' -> '॥'", r"॥\s*।", "॥", t)
    t = fx.sub("space: after danda", r"([।॥])(?=[%s‘“(⟦])" % DEVL, r"\1 ", t)
    t = fx.sub("space: after ,;:!? before a letter", r"([,;!?])(?=[%s%s])" % (DEVL, LAT), r"\1 ", t)
    if lang == "english":
        t = fx.sub("space: after full stop", r"(?<=[a-z\)][a-z\)])\.(?=[A-Z][a-z])", ". ", t)
    # abbreviation dot typed as ASCII zero: 'प0', 'महा0 वन0' -> 'प॰', 'महा॰ वन॰'
    t = fx.sub("abbreviation: ASCII 0 -> ॰", r"(?<=[%s])0(?=[\s.,;)\]]|$)" % DEV, "॰", t)
    # citations (गीता 7।29) / (15। 7) / (3। 14 — 15) -> (गीता 7.29) / (15.7) / (3.14–15)
    def cit(m):
        inner = m.group(0)
        if not re.search(r"\d", inner):
            return inner
        inner = re.sub(r"(\d)\s*।\s*(\d)", r"\1.\2", inner)
        inner = re.sub(r"(\d)\s*(?:—|–|-{1,2})\s*(\d)", r"\1–\2", inner)
        return inner
    t = fx.sub("citation: chapter।verse -> chapter.verse", r"[(\[][^()\[\]]{1,40}[)\]]", cit, t)
    # footnote markers (टिप्पणी प0 60.1) -> (टिप्पणी प॰ 60.1)
    t = fx.sub("footnote: marker tidied", r"\(\s*टिप्पणी\s*प?\s*['0०॰]*\s*([\d.]+)\s*\)", r"(टिप्पणी प॰ \1)", t)
    t = smart_quotes(t, fx)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


# ------------------------------------------------------------------ verse quotes
QUOTE_LEADIN = re.compile(r"(उक्तम्|उक्तं च|उक्तञ्च|आह|यथा|श्रुतिः|स्मृतिः|इति च|तथा च|च|हि|:|—)\s*$")
CITATION_RE = re.compile(r"^\s*[’']?\s*[(\[]([^()\[\]]{0,40}?\d[^()\[\]]{0,20})[)\]]")


def _metrical(h):
    n = D.count_syllables(h)
    return n, (15 <= n <= 17) or (20 <= n <= 26)


def metrical_ok(padas, counts):
    """Cadence test that separates real verse from prose that happens to have
    the right syllable count: anushtubh even padas have syllables 5-6 = laghu-guru
    (holds for all 646 anushtubh verses of the Gita); trishtubh/jagati padas end
    laghu-guru-x / guru-laghu-x (>= 3 of 4 padas; holds for 54 of 55 Gita verses)."""
    w = [D.weights(p) for p in padas]
    if all(7 <= c <= 9 for c in counts):
        return all(len(w[i]) >= 7 and w[i][4] == "S" and w[i][5] == "L" for i in range(1, len(padas), 2))
    good = sum(1 for x in w if (len(x) == 11 and x[-3] == "S" and x[-2] == "L") or
               (len(x) == 12 and x[-3] == "L" and x[-2] == "S"))
    return good >= len(padas) - 1


def format_quote(halves):
    """halves: list of half-verse strings -> (lines, meter)."""
    padas, mids = [], []
    for h in halves:
        n = D.count_syllables(h)
        k = n // 2 if n <= 18 else (11 if n in (22, 23) else n // 2)
        try:
            p1, p2, mid = D.split_at_syllable(h, k)
        except ValueError:
            return None, None
        padas += [p1, p2]
        mids += [mid, False]
    counts = [D.count_syllables(p) for p in padas]
    if not metrical_ok(padas, counts):
        return None, None
    if all(7 <= c <= 9 for c in counts):
        meter = "anushtubh"
        lines = []
        for i in range(0, len(padas), 2):
            sep = "" if mids[i] else " "
            lines.append(padas[i] + sep + padas[i + 1] + (" ॥" if i + 2 >= len(padas) else " ।"))
    else:
        meter = "trishtubh" if all(10 <= c <= 13 for c in counts) else "irregular"
        lines = []
        for i, p in enumerate(padas):
            s = p + ("-" if mids[i] else "")
            s += " ॥" if i == len(padas) - 1 else (" ।" if i % 2 == 1 else "")
            lines.append(s)
    return lines, meter


HALF_PAIR = re.compile(r"([^।॥‘’“”()\[\]]+)।\s*([^।॥‘’“”()\[\]]+)॥(\s*[\d०-९.]{1,8}\s*॥)?")


def extract_verse_quotes(text, fx, lang="sanskrit"):
    """Split a paragraph into [("text", str) | ("quote", lines, ref, meter, raw)]."""
    parts, pos = [], 0
    for m in HALF_PAIR.finditer(text):
        s1, s2 = m.group(1), m.group(2)
        lead = ""
        n1, ok1 = _metrical(s1.strip())
        n2, ok2 = _metrical(s2.strip())
        if not ok1 and ok2 and n1 > 17:
            # try to peel a lead-in ("तथा चोक्तम् ...") off the first half
            words = s1.split(" ")
            for k in range(1, min(6, len(words))):
                cand = " ".join(words[k:])
                nn, okk = _metrical(cand.strip())
                if okk and abs(nn - n2) <= 1 and QUOTE_LEADIN.search(" ".join(words[:k])):
                    lead, s1, ok1, n1 = " ".join(words[:k]) + " ", cand, True, nn
                    break
        if not (ok1 and ok2 and abs(n1 - n2) <= 2):
            continue
        # the quote must start at a sentence/quote boundary
        start = m.start() + len(lead) + (len(m.group(1)) - len(m.group(1).lstrip()) if not lead else 0)
        before = text[pos:m.start()] + lead
        if before.strip() and not re.search(r"([।॥:—‘“(]|इति|उक्तम्|च|हि|आह|यथा)\s*$", before.strip()) and not lead:
            # mid-sentence: only accept if the preceding char is a quote/danda
            if not re.search(r"[।॥:—‘“]\s*$", before):
                continue
        if lang == "hindi":
            # Hindi prose can scan by accident: require quote marks or a citation
            quoted = before.rstrip().endswith(("‘", "“", "'", '"')) or text[m.end():m.end() + 2].lstrip()[:1] in ("’", "”", "'", '"')
            if not quoted and not CITATION_RE.match(text[m.end():]):
                continue
        h1, h2 = s1.strip(), s2.strip()
        lines, meter = format_quote([h1, h2])
        if not lines:
            continue
        after = text[m.end():]
        ref = None
        cm = CITATION_RE.match(after)
        end = m.end()
        if cm:
            ref = cm.group(1).strip()
            end += cm.end()
        # drop wrapping quote marks around the verse
        b = before.rstrip()
        if b.endswith(("‘", "“")):
            before = b[:-1]
        a = text[end:]
        if a.lstrip().startswith(("’", "”")):
            a_strip = a.lstrip()[1:]
            end = len(text) - len(a_strip)
        if before.strip():
            parts.append(("text", before.strip()))
        raw = m.group(0)
        parts.append(("quote", lines, ref, meter, raw))
        fx.log("structure: embedded verse -> verse_quote block", raw[:80], " / ".join(lines)[:80])
        pos = end
    rest = text[pos:].strip()
    if rest:
        parts.append(("text", rest))
    return parts


# ------------------------------------------------------------------ pratikas
def verse_word_set(verse_padas):
    words = set()
    for p in verse_padas:
        for w in p.split(" "):
            n = D.norm(w)
            if len(n) >= 2:
                words.add(n)
                words.add(re.sub("[ंःम्]$", "", n))
    return words


def mark_pratikas_sanskrit(t, vwords, fx):
    """Sanskrit commentaries: '...आह  यदिति।' and '  verseword  ' -> ⟦…⟧."""
    def a(m):
        if m.group(2).strip() in ("इति", "इत्यादि", "इत्यादिना"):
            return m.group(0)
        return m.group(1) + PRATIKA_OPEN + m.group(2) + PRATIKA_CLOSE
    t = fx.sub("pratika: marked (… इति)", r"( {2,}|^)((?:[%s]+ ){0,2}[%s]*?%s)(?=[।\s]|$)" % (DEVL, DEVL, ITI_TAIL), a, t)

    def b(m):
        w = m.group(2)
        n = D.norm(w)
        if n in vwords or re.sub("[ंःम्]$", "", n) in vwords:
            return m.group(1) + PRATIKA_OPEN + w + PRATIKA_CLOSE
        return m.group(0)
    t = fx.sub("pratika: marked (verse word)", r"((?:^| {2,}))([%s]+)(?= {2,})" % DEVL, b, t)
    return t


def mark_pratikas_hindi(t, vwords, fx, author_id):
    if author_id == 1:
        # source sometimes drops the closing quote of the pratika: "'किरीटिनं … तथैव--"
        t = fx.sub("quotes: missing closing quote of pratika restored",
                   r"^(['‘])([^'‘’\n]{2,150}?)(\s*\(टिप्पणी[^)]*\))?(?=\s*--)",
                   lambda m: m.group(1) + m.group(2).rstrip() + "'" + (m.group(3) or ""), t)
        # Ramsukhdas: paragraph-initial ‘quoted verse words’ — explanation
        t = fx.sub("pratika: marked (quoted verse words)", r"^(['‘][^'‘’]{2,120}['’])(?=\s*(?:--|—|-))",
                   lambda m: PRATIKA_OPEN + m.group(1) + PRATIKA_CLOSE, t)
    if author_id == 2:
        # Chinmayananda: 'शब्द  व्याख्या' term definitions at sentence start
        def c(m):
            w = m.group(2)
            if any(D.norm(x) in vwords for x in w.split(" ")):
                return m.group(1) + PRATIKA_OPEN + w + PRATIKA_CLOSE + " "
            return m.group(0)
        t = fx.sub("pratika: marked (glossed term)", r"(^|(?<=[।॥]))\s*([%s]+(?: [%s]+){0,2}) {2,}" % (DEV, DEV), c, t)
    return t


def mark_pratikas_english_gloss(t, fx):
    """Sivananda gloss paragraph: 'कुलक्षये in the destruction…' -> ⟦कुलक्षये⟧."""
    return fx.sub("pratika: marked (Devanagari term in gloss)", r"(?<![%s⟦])([%s][%s]*(?: [%s]+)*)(?![%s⟧])" % (DEV, DEV, DEV, DEV, DEV),
                  lambda m: PRATIKA_OPEN + m.group(1) + PRATIKA_CLOSE, t)


# ------------------------------------------------------------------ main entry
def clean_entry(raw, lang, author_id, typ, verse_padas, fx):
    """-> (blocks, plain_text, placeholder)"""
    fx.entry_score = 0
    t = unicodedata.normalize("NFC", raw)
    if "&" in t and re.search(r"&(#\d+|#x[0-9a-f]+|[a-z]+);", t):
        t2 = html.unescape(t)
        fx.log("junk: HTML entity", t, t2)
        t = t2
    if re.search(r"<\/?[a-z][^>]*>", t):
        t = fx.sub("junk: HTML tag", r"<\/?[a-z][^>]*>", " ", t)
    t = t.replace("\r", "").replace(" ", " ").replace("\t", "  ")
    t = fx.sub("junk: zero-width / BOM / soft hyphen", r"[​﻿­]|(?<![%s])[‌‍]|[‌‍](?![%s])" % (DEV, DEV), "", t)
    t = fx.sub("danda: Bengali '৷' (mojibake) -> '।'", "\u09f7", "।", t)
    t = strip_prefix(t, fx)
    for _ in range(3):
        for rx, rep, cat in ENC_RULES:
            t = fx.sub(cat, rx, rep, t)
    t = fix_question_marks(t, lang, fx)
    vwords = verse_word_set(verse_padas)

    # ---- paragraphs
    if typ == "translation":
        t = fx.sub("linebreak: hyphenated word re-joined", r"(?<=[a-z])-\n(?=[a-z])", "", t)
        t = re.sub(r"[ ]*\n(?![ ]*\n)[ ]*", " ", t.strip())
    else:
        t = fx.sub("linebreak: hyphenated word re-joined", r"(?<=[a-z])-\n(?=[a-z])", "", t)
        # a newline that splits a sentence is not a paragraph break
        t = fx.sub("linebreak: stray newline inside a sentence joined",
                   r"(?<=[%s%s,])[ ]*\n[ ]*(?=[%s%s(])" % (DEVL, "a-z", DEVL, "a-z"), " ", t)
    if author_id == 16 and typ == "commentary":
        t = re.sub(r"(?<=[.?!,])\s*Commentary[:.]?\s+", "\n\n\x00HEAD:Commentary\n\n", t)
    if author_id == 1 and lang == "hindi":
        alt = "|".join(RAMSUKHDAS_HEADINGS + RAMSUKHDAS_LABELS)
        t = re.sub(r"(?:^|\s+|(?<=[।॥]))(?:[।॥]\s*)?(%s)\s*(?:--|—|:-|:)\s*" % alt, lambda m: "\n\n\x00LBL:%s\n" % m.group(1), t)
    paras = re.split(r"\s*\n\s*", t)

    blocks, pending_label = [], None
    for p in paras:
        if not p.strip():
            continue
        if p.startswith("\x00HEAD:") or (p.startswith("\x00LBL:") and p[5:] in RAMSUKHDAS_HEADINGS):
            blocks.append({"type": "heading", "text": p.split(":", 1)[1]})
            continue
        if p.startswith("\x00LBL:"):
            pending_label = p[5:]
            continue
        if lang == "sanskrit":
            p = mark_pratikas_sanskrit(p, vwords, fx)
        elif lang == "hindi":
            p = mark_pratikas_hindi(p.strip(), vwords, fx, author_id)
        elif lang == "english" and author_id == 16 and typ == "commentary" and not any(b["type"] == "heading" for b in blocks):
            p = mark_pratikas_english_gloss(p, fx)
        p = normalize_inline(p, lang, fx)
        if lang == "english" and typ == "translation" and p[:1].islower():
            fx.log("case: sentence-initial capital", p[:20], p[:1].upper() + p[1:20])
            p = p[:1].upper() + p[1:]
        if re.fullmatch(r"[\s.,;:।॥\-—]*", p):
            continue
        pieces = (extract_verse_quotes(p, fx, lang) if typ == "commentary" and lang in ("sanskrit", "hindi") and "॥" in p
                  else [("text", p)])
        for pc in pieces:
            if pc[0] == "text":
                txt = re.sub(r"^[,;:]\s*|\s*[,;]$", "", pc[1]).strip()
                if not txt or re.fullmatch(r"[\s.,;:।॥\-—]*", txt):
                    continue
                b = {"type": "paragraph", "text": txt}
                if pending_label:
                    b["label"] = pending_label
                    pending_label = None
                blocks.append(b)
            else:
                _, lines, ref, meter, rawq = pc
                b = {"type": "verse_quote", "lines": lines, "text": " ".join(l.rstrip(" ।॥-") for l in lines)}
                if ref:
                    b["ref"] = ref
                if meter:
                    b["meter"] = meter
                blocks.append(b)
    # merge a dangling 'इति …' paragraph? keep as is (author's text)
    # trailing junk on the last paragraph
    if blocks and blocks[-1]["type"] == "paragraph":
        last = blocks[-1]["text"]
        cleaned = re.sub(r"[\s,;]+$", "", last)
        cleaned = re.sub(r"\.,$", ".", cleaned)
        if cleaned != last:
            fx.log("junk: trailing punctuation", last[-20:], cleaned[-20:])
            blocks[-1]["text"] = cleaned
    plain = "\n\n".join(plain_of(b) for b in blocks)
    placeholder = 1 if (len(plain) < 160 and PLACEHOLDER_RE.search(plain)) else 0
    return blocks, plain, placeholder


def plain_of(b):
    if b["type"] == "verse_quote":
        s = "\n".join(b["lines"])
        return s + (" (" + b["ref"] + ")" if b.get("ref") else "")
    s = b["text"].replace(PRATIKA_OPEN, "").replace(PRATIKA_CLOSE, "")
    if b.get("label"):
        s = b["label"] + " — " + s
    return s
