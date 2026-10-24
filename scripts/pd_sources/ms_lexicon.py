"""Vocabulary + repair of OCR-garbled words in the Mahadeva Sastri scan.

Sastri marks retroflex/palatal letters by italics (Brâhma*n*a, *s*ruti); ABBYY turned many italic
letters into junk ("Brahma/ia", "gu«as", "sa;«sara").  The original's circumflexes (â î û) are
not in the OCR at all.  We therefore print Sanskrit words in plain letters as the OCR shows them
and repair a garbled token only when exactly one plausible word of the book's own vocabulary fits.
"""
import os, re, sys
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import CACHE
from textfix import ntok
from common import db

_LEX = None
SHORT2 = set('an as at be by do he if in is it me my no of oh on or so to up us we ye am go lo ii iv vi ix xi xv'.split())
GARB = r"[;/«»\^7\(\)\|\\<>{}~£€■•\]\[1!?:'\"’]"


def _iast_plain(s):
    s = s.lower()
    for a, b in [('ā', 'a'), ('ī', 'i'), ('ū', 'u'), ('ṝ', 'ri'), ('ṛ', 'ri'), ('ḷ', 'li'), ('ṅ', 'n'), ('ñ', 'n'),
                 ('ṇ', 'n'), ('ṭ', 't'), ('ḍ', 'd'), ('ś', 's'), ('ṣ', 'sh'), ('ṃ', 'm'), ('ḥ', 'h'), ('c', 'ch')]:
        s = s.replace(a, b)
    return re.sub(r'[^a-z]', '', s)


def lexicon():
    """Counter of plain lowercase words: the book's own clean tokens + DB lemmas in Sastri's spelling."""
    global _LEX
    if _LEX is not None:
        return _LEX
    t = open(os.path.join(CACHE, 'ms.txt'), encoding='utf-8', errors='replace').read()
    c = Counter()
    for w in re.findall(r"(?<![\w;/«»^])[A-Za-z]+(?![\w;/«»^])", t):
        c[w.lower()] += 1
    lex = Counter({w: n for w, n in c.items() if n >= 2})
    con = db()
    trusted = set()
    for (lem,) in con.execute('select distinct lemma from words'):
        if lem:
            p = _iast_plain(lem)
            if len(p) > 2:
                lex[p] += 3
                lex[p + 's'] += 3
                trusted.update((p, p + 's'))
    # stems like karman/atman are printed karma/atma by Sastri
    for t in list(trusted):
        if t.endswith('an'):
            trusted.update((t[:-1], t[:-1] + 's'))
    global TRUSTED
    TRUSTED = trusted
    _LEX = lex
    return lex


TRUSTED = set()


ABBR = {'&c', 'i.e', 'e.g', 'viz', 'cf', 'etc', 'ibid', 'sk', 'bri', 'chh', 'up', 'om', 'ait', 'mund', 'svet', 'tait', 'br', 'bh', 'ch'}


def known(w, vocab, lex):
    raw = w.strip(".,;:()[]'\"").lower()
    if raw in ABBR or re.fullmatch(r'[ivxlc]+', raw) or re.fullmatch(r'[a-z]', raw) and w.strip(' ').endswith('.'):
        return True
    w = re.sub(r"['’]s$", '', w)
    n = ntok(w)
    if not n or n.isdigit():
        return True
    if len(n) == 1:
        # single letters are abbreviations (i. e., v. 11) — but not when glued to junk ("b:^")
        return re.fullmatch(r"[A-Za-z][.,;:)]*", w.strip('("[')) is not None
    if len(n) == 2:
        return n in SHORT2 or n in ('cf', 'sk', 'up', 'om', 'br', 'bh')
    if n in vocab or lex.get(n, 0) >= 3:
        return True
    for suf in ('s', 'es', 'ed', 'd', 'ing', 'ly', 'ness', 'less', 'lessness', 'ies', 'ied', 'er', 'est', 'ment', 'ments'):
        if n.endswith(suf):
            st = n[:-len(suf)]
            if st in vocab or st + 'e' in vocab or (suf in ('ies', 'ied') and st + 'y' in vocab) or \
                    (len(st) > 2 and st[-1] == st[-2] and st[:-1] in vocab):
                return True
    return False


def fix_token(w, vocab, lex, stats):
    stats['tokens'] += 1
    m = re.match(r"^([\(\[\"'‘“]*)(.*?)([\)\]\"'’”,.;:!?]*)$", w)
    pre, core, post = m.group(1), m.group(2), m.group(3)
    if not core or not re.search(r'[A-Za-z]', core):
        return w
    garbled = re.search(r'[A-Za-z]' + GARB + r'+[A-Za-z]', core) or re.search(r'[A-Za-z]' + GARB + r'+$', core) \
        or re.search(r'[a-z][A-Z]', core) or re.search(r'[a-z]\d|\d[a-z]', core)
    if not garbled:
        # italic n read as "w" ("guwas", "Brahmawa"): prefer the n-form when the book uses it far more often
        if 'w' in core[1:]:
            lc = core.lower()
            for k in range(1, len(lc)):
                if lc[k] == 'w' and lc[k - 1] in 'aeiou' and (k + 1 == len(lc) or lc[k + 1] in 'aeiou'):
                    alt = lc[:k] + 'n' + lc[k + 1:]
                    if lex.get(alt, 0) >= 3 * max(1, lex.get(lc, 0)) and ntok(alt) not in vocab or \
                            (lex.get(alt, 0) >= 3 * max(1, lex.get(lc, 0)) and ntok(lc) not in vocab):
                        new = alt[:1].upper() + alt[1:] if core[:1].isupper() else alt
                        stats['fixed'] += 1
                        return pre + new + post
        if not known(core.replace('-', ''), vocab, lex) and not all(known(p, vocab, lex) for p in core.split('-') if p):
            fx = spell1(core, lex)
            if fx:
                stats['fixed'] += 1
                stats.setdefault('fixed_list', []).append((core, fx))
                return pre + fx + post
            stats['unknown'] += 1
            stats.setdefault('unknown_list', []).append(core)
        return w
    # build a pattern: every junk run stands for 0-2 letters (italic n, m, t, d, s, ri ...)
    parts = []
    for seg in re.split(r'(' + GARB + r'+|(?<=[a-z])[A-Z]|\d)', core):
        if not seg:
            continue
        if re.fullmatch(GARB + r'+|[A-Z]|\d', seg) and parts:
            parts.append('[a-z]{0,3}')
        else:
            parts.append(re.escape(seg.lower()))
    pat = re.compile('^' + ''.join(parts) + '$')
    cands = [(n, x) for x, n in lex.items() if pat.match(x)]
    if not cands and 'ii' in core:              # ABBYY reads the circumflexed a as "ii"
        pat = re.compile('^' + ''.join(parts).replace('ii', 'a') + '$')
        cands = [(n, x) for x, n in lex.items() if pat.match(x)]
    if '-' in core:
        # compounds: repair each part separately
        sub = [fix_token(p, vocab, lex, {'tokens': 0, 'fixed': 0, 'unknown': 0}) for p in core.split('-')]
        new = '-'.join(sub)
        if new != core:
            stats['fixed'] += 1
            return pre + new + post
    tr = sorted(((n, x) for n, x in cands if x in TRUSTED or x in vocab), reverse=True)
    if tr and (len(tr) == 1 or tr[0][0] >= 3 * tr[1][0]):
        x = tr[0][1]
        new = x[:1].upper() + x[1:] if core[:1].isupper() else x
        stats['fixed'] += 1
        return pre + new + post
    if cands and not tr:
        cands.sort(reverse=True)
        if len(cands) == 1 or cands[0][0] >= 3 * cands[1][0]:
            x = cands[0][1]
            new = x[:1].upper() + x[1:] if core[:1].isupper() else x
            stats['fixed'] += 1
            return pre + new + post
    stats['unknown'] += 1
    stats.setdefault('unknown_list', []).append(core)
    return w


_LETTERS = 'abcdefghijklmnopqrstuvwxyz'


def spell1(core, lex):
    """Single-edit correction to a frequent word of the book itself (>=5 clean occurrences), only when
    unambiguous (the best candidate is 4x more frequent than the next)."""
    w = core.lower()
    if len(w) < 4 or not w.isalpha():
        return None
    splits = [(w[:i], w[i:]) for i in range(len(w) + 1)]
    edits = set([a + b[1:] for a, b in splits if b] +
                [a + b[1] + b[0] + b[2:] for a, b in splits if len(b) > 1] +
                [a + c + b[1:] for a, b in splits if b for c in _LETTERS] +
                [a + c + b for a, b in splits for c in _LETTERS])
    cands = sorted(((lex.get(e, 0), e) for e in edits if lex.get(e, 0) >= 5), reverse=True)
    if not cands:
        return None
    if len(cands) > 1 and cands[0][0] < 4 * cands[1][0]:
        return None
    x = cands[0][1]
    if core[:1].isupper():
        x = x[:1].upper() + x[1:]
    return x


_BI = None


def bigrams():
    global _BI
    if _BI is None:
        t = open(os.path.join(CACHE, 'ms.txt'), encoding='utf-8', errors='replace').read().lower()
        ws = re.findall(r"[a-z]+", t)
        _BI = Counter(zip(ws, ws[1:]))
    return _BI


def fix_short(prev, w, nxt):
    """Context repair of a 2-3 letter non-word ("will bs subject" -> "be") using the book's own bigrams."""
    core = re.sub(r'[^a-z]', '', w.lower())
    if not (2 <= len(core) <= 3) or core in SHORT2:
        return None
    bi = bigrams()
    p = re.sub(r'[^a-z]', '', prev.lower())
    nx = re.sub(r'[^a-z]', '', nxt.lower())
    cands = []
    for c in SHORT2 | {'the', 'and', 'but', 'not', 'for', 'are', 'was', 'his', 'him', 'who', 'all', 'one', 'has', 'had', 'its', 'thy', 'out'}:
        if len(c) == len(core) and sum(1 for a, b in zip(c, core) if a != b) == 1:
            cands.append((2 * bi.get((p, c), 0) + bi.get((c, nx), 0), c))
    cands.sort(reverse=True)
    if cands and cands[0][0] >= 8 and (len(cands) == 1 or cands[0][0] >= 3 * max(1, cands[1][0])):
        return cands[0][1]
    return None
