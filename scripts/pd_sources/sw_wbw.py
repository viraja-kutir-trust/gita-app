"""Parse Swarupananda's word-for-word paraphrase and reconstruct the Sanskrit headwords.

The OCR of a word-for-word block is a sequence  <Devanagari headword> <English gloss> ...  in which
many headwords are mis-read (sometimes as Latin junk).  We

  1. label every OCR token as Headword (H) or English (E) with a small DP (run-length constraints,
     costs from script / vocabulary / punctuation evidence, using both our OCR and the DLI OCR);
  2. pair each H-run with the following E-run (= the book's gloss, verbatim);
  3. map each H-run to a word (or compound span) of our verse from the DCS analysis in the DB, by
     Devanagari similarity; unmatched H-runs are resolved by gloss similarity with the DB's
     word_meanings, or by elimination when only one verse word is left.  The output headword is
     always our DB form, never the OCR guess.
"""
import difflib, json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import db, DEV_RE, is_dev
from textfix import tidy

try:
    from indic_transliteration import sanscript
    from indic_transliteration.sanscript import transliterate
except Exception:          # pragma: no cover
    transliterate = None

# ---------------------------------------------------------------- inventory from the DB

_INV = None


def _speaker_items(sp_dev):
    out = []
    if not sp_dev:
        return out
    sp_dev = sp_dev.strip()
    if sp_dev.endswith('उवाच') and ' ' not in sp_dev:          # श्रीभगवानुवाच
        out = ['श्रीभगवान्', 'उवाच']
    else:
        out = sp_dev.split()
    return out


def inventory():
    """{(c,v): {'words':[...], 'wm':[...], 'speaker':[...]} }"""
    global _INV
    if _INV is not None:
        return _INV
    con = db()
    vs = {r['id']: (r['chapter'], r['verse'], r['speaker']) for r in con.execute('select id, chapter, verse, speaker from verses')}
    inv = {}
    for vid, (c, v, sp) in vs.items():
        ws = [dict(r) for r in con.execute('select idx, form, unsandhied, form_dev, lemma, lemma_dev, pos, morph from words where verse_id=? order by idx', (vid,))]
        wm = [dict(r) for r in con.execute('select idx, term_iast, term_dev, meaning, dcs_idx_json from word_meanings where verse_id=? order by idx', (vid,))]
        spk = []
        if sp and not any(w['form'] == 'uvāca' for w in ws):
            for s in _speaker_items(sp):
                spk.append({'form_dev': s, 'iast': transliterate(s, sanscript.DEVANAGARI, sanscript.IAST) if transliterate else s})
        inv[(c, v)] = {'words': ws, 'wm': wm, 'speaker': spk}
    _INV = inv
    return inv


def dev_norm(s):
    s = unicodedata.normalize('NFC', s)
    s = s.replace('‌', '').replace('‍', '').replace('़', '')
    s = s.replace(':', 'ः').replace('ँ', 'ं')
    s = re.sub(r'[^ऀ-ॿ]', '', s)
    s = s.replace('॥', '').replace('।', '')
    return s


def candidates(verses):
    """Candidate headwords for the verses of a unit.

    Each candidate: {key, verse, idxs (tuple of DCS word indices or ('spk',i)), dev, dev_disp, iast, meanings}
    """
    inv = inventory()
    cands = []
    for (c, v) in verses:
        it = inv.get((c, v))
        if not it:
            continue
        ws = it['words']
        wm_by_idx = {}
        for m in it['wm']:
            for i in json.loads(m['dcs_idx_json'] or '[]'):
                wm_by_idx.setdefault(i, []).append(m['meaning'])
        n = len(ws)
        for i in range(n):
            # spans i..j where i..j-1 are compound members
            j = i
            while True:
                span = ws[i:j + 1]
                dev = ''.join(w['form_dev'] for w in span)
                disp = '-'.join(w['form_dev'] for w in span)
                iast = '-'.join(w['unsandhied'] for w in span)
                means = []
                for w in span:
                    means.extend(wm_by_idx.get(w['idx'], []))
                cands.append({'verse': (c, v), 'idxs': tuple(w['idx'] for w in span), 'dev': dev_norm(dev),
                              'dev_disp': disp, 'iast': iast, 'meanings': means})
                if 'compound member' not in (ws[j]['morph'] or '') or j + 1 >= n or j - i >= 5:
                    break
                j += 1
        for i in range(n - 1):              # two adjacent words glossed together ("श्रीभगवान् उवाच")
            span = ws[i:i + 2]
            if 'compound member' in (span[0]['morph'] or ''):
                continue
            cands.append({'verse': (c, v), 'idxs': (span[0]['idx'], span[1]['idx']),
                          'dev': dev_norm(span[0]['form_dev'] + span[1]['form_dev']),
                          'dev_disp': span[0]['form_dev'] + ' ' + span[1]['form_dev'],
                          'iast': span[0]['unsandhied'] + ' ' + span[1]['unsandhied'],
                          'meanings': wm_by_idx.get(span[0]['idx'], []) + wm_by_idx.get(span[1]['idx'], []), 'pair': True})
        for k, s in enumerate(it['speaker']):
            cands.append({'verse': (c, v), 'idxs': (('spk', k),), 'dev': dev_norm(s['form_dev']), 'dev_disp': s['form_dev'],
                          'iast': s['iast'], 'meanings': []})
    return cands


# ---------------------------------------------------------------- token labelling

def _letters(s):
    return re.sub(r'[^A-Za-zऀ-ॿ]', '', s)


def dev_frac(s):
    l = _letters(s)
    if not l:
        return 0.0
    return len(DEV_RE.findall(l)) / float(len(l))


def tok_costs(w, vocab, wset=None):
    """(cost_as_H, cost_as_E) for one OCR word with alternate reading.

    wset: normalised English tokens seen in the witness (1967 reprint) gloss block of this unit,
    or None when no witness is available."""
    t = w['t']
    a = w.get('alt') or ''
    core = re.sub(r"^[\(\[\"'‘“]+|[\)\]\"'’”,.;:!?]+$", '', t)
    low = re.sub(r'[^a-z]', '', core.lower())
    d_t, d_a = dev_frac(t), max(dev_frac(a), dev_frac(w.get('alt_orig') or ''))
    if d_t >= 0.5:
        return (0.0, 6.0)
    in_w = wset is not None and low and (low in wset or (len(low) >= 5 and core.islower() and
                                                      any(abs(len(x) - len(low)) <= 2 and _lev2(low, x) for x in wset)))
    if d_a >= 0.6 and not in_w and not (low in vocab and len(low) > 2):
        return (0.4, 3.0)
    if re.match(r'^[\(\[]', t) and not is_dev(t):
        return (4.0, 0.0)                       # parenthetical explanation is gloss text
    if not re.search(r'[A-Za-z0-9\u0900-\u097F]', t):
        return (4.0, 0.0)                       # bare punctuation belongs to the gloss
    eng = (low in vocab) and (core.islower() or len(core) > 3 or core in ('I', 'O', 'A'))
    alt_low = re.sub(r'[^a-z]', '', a.lower()) if a and not is_dev(a) else ''
    alt_eng = bool(alt_low) and alt_low in vocab
    if in_w or (wset is not None and alt_low and alt_low in wset):
        return (4.0, 0.0)
    if wset is not None and len(wset) > 3:
        # a witness exists: tokens it does not show are probably mis-read headwords
        if eng and alt_eng and len(low) > 3:
            return (1.5, 0.8)
        if re.search(r'[:;]$', t) and len(core) <= 8:
            return (0.3, 3.0)
        return (0.6, 2.2)
    if eng and (alt_eng or not a):
        return (4.0, 0.0)
    if eng:
        return (2.5, 0.3)
    if alt_eng:
        return (2.0, 0.5)
    if re.search(r'[:;]$', t) and len(core) <= 8:
        return (0.6, 2.5)                       # visarga read as colon
    if re.search(r'[A-Z]{2,}', core) or re.search(r'[0-9@#$%&*{}<>|\\^~_=+]', core):
        return (0.8, 2.0)
    if len(_letters(core)) == 0:
        return (2.0, 0.6)                       # punctuation
    return (1.4, 1.0)


def _lev2(a, b):
    """edit distance <= 2 (cheap check)"""
    if a == b:
        return True
    return difflib.SequenceMatcher(None, a, b).ratio() >= 0.8 and abs(len(a) - len(b)) <= 2


def prepare_tokens(words, vocab, wset=None):
    """Drop letter-less specks; prefer the DLI reading when ours is junk and theirs is a word."""
    out = []
    # glue a stand-alone "(" to the following token
    glued = []
    for w in words:
        if glued and glued[-1]['t'] in ('(', '[') :
            glued[-1] = dict(w, t=glued[-1]['t'] + w['t'], alt=('(' + w['alt']) if w.get('alt') else None)
            continue
        glued.append(w)
    words = glued
    for w in words:
        t, a = w['t'], (w.get('alt') or '')
        if not re.search(r'[A-Za-z\u0900-\u097F]', t):
            al = re.sub(r'[^a-z]', '', a.lower())
            if a and not is_dev(a) and al and (al in vocab or (wset and al in wset)):
                w = dict(w, t=a)
            elif a and dev_frac(a) >= 0.6:
                w = dict(w, t=a)
            elif re.fullmatch(r'[()\[\],.;:]+', t):
                pass
            else:
                continue
        else:
            tl = re.sub(r'[^a-z]', '', t.lower())
            o = w.get('alt_orig') or ''
            ol = re.sub(r'[^a-z]', '', o.lower()) if o and not is_dev(o) else ''
            if not is_dev(t) and tl and tl not in vocab and not (wset and tl in wset) and ol and \
                    (ol in vocab or (wset and ol in wset)) and abs(len(ol) - len(tl)) <= 2:
                w = dict(w, t=o)
                t = o
                tl = ol
            al = re.sub(r'[^a-z]', '', a.lower()) if a and not is_dev(a) else ''
            if not is_dev(t) and tl and tl not in vocab and not (wset and tl in wset) and al and \
                    (al in (wset or ()) or al in vocab) and len(al) >= len(tl) - 1:
                w = dict(w, t=re.sub(r'[A-Za-z]+', a.strip('.,;:'), t, count=1) if len(t) == len(t.strip('.,;:')) else a)
        out.append(w)
    return out


def label_tokens(words, vocab, wset=None):
    """DP labelling: H-runs of length 1..3, E-runs >= 1, must start with H (gloss blocks always do)."""
    n = len(words)
    if n == 0:
        return []
    costs = [tok_costs(w, vocab, wset) for w in words]
    INF = 1e9
    # state: (label, runlen) with runlen capped (H:1..3, E:1)
    states = [('H', 1), ('H', 2), ('H', 3), ('E', 1)]
    dp = [[INF] * 4 for _ in range(n)]
    bp = [[-1] * 4 for _ in range(n)]
    dp[0][0] = costs[0][0]
    dp[0][3] = costs[0][1] + 1.5               # starting with English is unusual
    for i in range(1, n):
        ch, ce = costs[i]
        # H1 from E
        dp[i][0] = dp[i - 1][3] + ch; bp[i][0] = 3
        dp[i][1] = dp[i - 1][0] + ch + 0.8; bp[i][1] = 0      # 2-token headword: small penalty
        dp[i][2] = dp[i - 1][1] + ch + 1.6; bp[i][2] = 1
        best, arg = INF, -1
        for s in (0, 1, 2, 3):
            if dp[i - 1][s] < best:
                best, arg = dp[i - 1][s], s
        dp[i][3] = best + ce; bp[i][3] = arg
    s = min(range(4), key=lambda k: dp[n - 1][k])
    labs = [None] * n
    for i in range(n - 1, -1, -1):
        labs[i] = states[s][0]
        s = bp[i][s]
    return labs


def pairs_from(words, labs):
    out = []
    cur = None
    for w, l in zip(words, labs):
        if l == 'H':
            if cur is None or cur['E']:
                cur = {'H': [], 'E': []}
                out.append(cur)
            cur['H'].append(w)
        else:
            if cur is None:
                cur = {'H': [], 'E': []}
                out.append(cur)
            cur['E'].append(w)
    return out


# ---------------------------------------------------------------- gloss similarity

STOP = set('the a an of in to by is be with for as at on from'.split())


def _content(s):
    ws = re.findall(r'[a-z]+', (s or '').lower())
    return set(w[:5] for w in ws if w not in STOP and len(w) > 1 or w in ('o', 'i'))


def gloss_sim(g, meanings):
    a = _content(g)
    if not a:
        return 0.0
    best = 0.0
    for m in meanings:
        b = _content(m)
        if b:
            best = max(best, len(a & b) / float(len(a | b)))
    return best


_TR = [('ā', 'a'), ('ī', 'i'), ('ū', 'u'), ('ṝ', 'ri'), ('ṛ', 'ri'), ('ḷ', 'li'), ('ṅ', 'n'), ('ñ', 'n'), ('ṇ', 'n'),
       ('ṭ', 't'), ('ḍ', 'd'), ('ś', 'sh'), ('ṣ', 'sh'), ('ṃ', 'm'), ('ḥ', 'h'), ('c', 'ch'), ('-', ''), (' ', '')]


def iast_ascii(s):
    s = s.lower()
    for a, b in _TR:
        s = s.replace(a, b)
    return s


def translit_sim(g, iast):
    """Proper names / technical terms in the gloss (Kshetra, Hrishikesha) vs the candidate's IAST."""
    t = iast_ascii(iast)
    t2 = re.sub(r'(h|m|s|n)$', '', t)
    best = 0.0
    for w in re.findall(r'[A-Z][a-z\u00e0-\u00ff]+', g):
        w = re.sub(r'[^a-z]', '', strip_acc_l(w))
        if len(w) < 4:
            continue
        for x in (t, t2):
            best = max(best, difflib.SequenceMatcher(None, w, x).ratio())
    return best


def strip_acc_l(w):
    w = unicodedata.normalize('NFKD', w)
    return ''.join(c for c in w if not unicodedata.combining(c)).lower()


def dev_sim(readings, cand_dev):
    best = 0.0
    for r in readings:
        r = dev_norm(r)
        if len(r) < 1:
            continue
        best = max(best, difflib.SequenceMatcher(None, r, cand_dev, autojunk=False).ratio())
    return best


def _keys(c):
    return set((c['verse'], i) for i in c['idxs'])


def match_pairs(pairs, verses):
    """Assign each pair a candidate.  Returns (list of (pair, cand|None, method, score), uncovered)."""
    cands = candidates(verses)
    singles = [c for c in cands if len(c['idxs']) == 1 and not c.get('pair')]
    used = set()            # (verse, idx)
    assign = [None] * len(pairs)
    readings = []
    for p in pairs:
        rs = []
        for key in ('t', 'alt', 'alt_orig', 'alt_san', 'alt_Devanagari'):
            r = ' '.join((w.get(key) or '') for w in p['H']).strip()
            if dev_norm(r):
                rs.extend([r, r.replace(' ', '')])
        readings.append(rs)
    # composite candidates: a 2-3 token headword run whose tokens are separate verse words (book order)
    for pi, p in enumerate(pairs):
        if len(p['H']) < 2:
            continue
        parts = []
        for w in p['H']:
            rs = [x for x in (w['t'], w.get('alt') or '', w.get('alt_orig') or '', w.get('alt_san') or '', w.get('alt_Devanagari') or '') if dev_norm(x)]
            if not rs:
                parts = None
                break
            best = max(((dev_sim(rs, c['dev']), ci) for ci, c in enumerate(singles)), default=(0, None))
            if best[0] < 0.6:
                parts = None
                break
            parts.append(singles[best[1]])
        if parts and len(set((c['verse'], c['idxs']) for c in parts)) == len(parts) and len(set(c['verse'] for c in parts)) == 1:
            cands.append({'verse': parts[0]['verse'], 'idxs': tuple(i for c in parts for i in c['idxs']),
                          'dev': dev_norm(''.join(c['dev_disp'] for c in parts)),
                          'dev_disp': ' '.join(c['dev_disp'] for c in parts), 'iast': ' '.join(c['iast'] for c in parts),
                          'meanings': [m for c in parts for m in c['meanings']], 'pair': True, 'composite_for': pi})
    scored = []
    for pi, p in enumerate(pairs):
        if not readings[pi]:
            continue
        g = ' '.join(w['t'] for w in p['E'])
        multi = len(p['H']) > 1
        srcs = []
        for key in ('t', 'alt', 'alt_orig', 'alt_san', 'alt_Devanagari'):
            r = ' '.join((w.get(key) or '') for w in p['H']).strip()
            if dev_norm(r):
                srcs.append([r, r.replace(' ', '')])
        for ci, c in enumerate(cands):
            if c.get('pair') and not multi:
                continue
            if c.get('composite_for') is not None and c['composite_for'] != pi:
                continue
            per = [dev_sim(rs, c['dev']) for rs in srcs]
            s = max(per) if per else 0.0
            agree = sum(1 for x in per if x >= 0.75)
            if c.get('composite_for') == pi:
                s = max(s, 0.75)
            if s >= 0.6 or (agree >= 2) or (s >= 0.5 and len(c['dev']) <= 3):
                s2 = s + 0.04 * max(0, agree - 1) + 0.15 * max(gloss_sim(g, c['meanings']), translit_sim(g, c['iast']))
                scored.append((s2, s, pi, ci))
    scored.sort(key=lambda x: (-x[0], -len(cands[x[3]]['idxs'])))
    for s2, s, pi, ci in scored:
        if assign[pi] is not None:
            continue
        c = cands[ci]
        if _keys(c) & used:
            continue
        assign[pi] = (ci, 'dev', round(s, 3))
        used |= _keys(c)
    # second pass: gloss / transliteration similarity against remaining words
    rem = [pi for pi in range(len(pairs)) if assign[pi] is None]
    scored = []
    for pi in rem:
        g = ' '.join(w['t'] for w in pairs[pi]['E'])
        for ci, c in enumerate(cands):
            if c.get('composite_for') is not None:
                continue
            if _keys(c) & used:
                continue
            gs = max(gloss_sim(g, c['meanings']), translit_sim(g, c['iast']) if translit_sim(g, c['iast']) >= 0.75 else 0)
            ds = dev_sim(readings[pi], c['dev']) if readings[pi] else 0.0
            sc = gs + 0.5 * ds
            if gs >= 0.34 or (ds >= 0.4 and gs >= 0.2):
                scored.append((sc, pi, ci))
    scored.sort(key=lambda x: -x[0])
    for sc, pi, ci in scored:
        if assign[pi] is not None:
            continue
        c = cands[ci]
        if _keys(c) & used:
            continue
        assign[pi] = (ci, 'gloss', round(sc, 3))
        used |= _keys(c)
    # elimination: one pair left and the remaining verse words form exactly one candidate
    rem = [pi for pi in range(len(pairs)) if assign[pi] is None and not supplied(pairs[pi])]
    if len(rem) == 1:
        left = [ci for ci, c in enumerate(cands) if not c.get('pair') and not (_keys(c) & used)]
        allkeys = set()
        for ci in left:
            allkeys |= _keys(cands[ci])
        full = [ci for ci in left if _keys(cands[ci]) == allkeys]
        if len(full) == 1:
            assign[rem[0]] = (full[0], 'elimination', 0.0)
            used |= allkeys
    out = []
    for pi, p in enumerate(pairs):
        a = assign[pi]
        if a is None and supplied(p):
            out.append((p, {'verse': None, 'idxs': (), 'dev_disp': supplied(p), 'iast': transliterate(supplied(p).strip('()'), sanscript.DEVANAGARI, sanscript.IAST).join('()') if transliterate else None,
                            'meanings': []}, 'supplied', 0.0))
            continue
        out.append((p, cands[a[0]] if a else None, a[1] if a else None, a[2] if a else 0.0))
    allw = set()
    for c in cands:
        for i in c['idxs']:
            if not isinstance(i, tuple):
                allw.add((c['verse'], i))
    uncovered = sorted(allw - used)
    return out, uncovered


def supplied(p):
    """A parenthesised Devanagari word supplied by the translator, e.g. "(तु but)", read identically by both OCRs."""
    if len(p['H']) != 1:
        return None
    w = p['H'][0]
    t, a = w['t'], w.get('alt') or ''
    if not t.startswith('('):
        return None
    ct = re.sub(r'[^\u0900-\u097F]', '', t)
    ca = re.sub(r'[^\u0900-\u097F]', '', a)
    if ct and ct == ca and re.fullmatch(r'[\u0900-\u097F]+', ct):
        return '(' + ct + ')'
    return None


def clean_gloss(ewords, vocab):
    toks = [w['t'] for w in ewords]
    s = ' '.join(toks)

    def dehy(m):
        a, b = m.group(1), m.group(2)
        j = (a + b).lower()
        if re.sub(r'[^a-z]', '', j) in vocab or not b[0].isupper() and re.sub(r'[^a-z]', '', b.lower()) not in vocab:
            return a + b
        return a + '-' + b
    s = re.sub(r"([A-Za-z']+)- ([A-Za-z']+)", dehy, s)   # de-hyphenate across line break
    return tidy(s)
