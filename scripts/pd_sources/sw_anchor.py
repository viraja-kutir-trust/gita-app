"""Anchor the sacred-texts translation paragraphs in the 1909 OCR stream.

For every numbered translation paragraph of the sacred-texts transcription (book numbering), find
the run of OCR lines in the 1909 scan that carries the same English rendering.  The anchors cut the
stream into per-unit regions:

    [gap: Sanskrit verse, label, word-for-word]  [translation lines]  [bracketed comments]
"""
import difflib, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sacred
from sw_layout import load_pages, classify, dev_ratio


def norm_tok(w):
    w = unicodedata.normalize('NFKD', w)
    w = ''.join(c for c in w if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z]', '', w)


def toks(s):
    return [t for t in (norm_tok(w) for w in re.split(r"[\s—\-]+", s)) if t]


def book_entries():
    """Sacred-texts entries in book order: [{'ch', 'start', 'end', 'text', 'notes'}]"""
    out = []
    for c, (vs, notes) in sacred.load().items():
        for v in vs:
            e = dict(v)
            e['ch'] = c
            e['notes'] = []
            for n in range(v['start'], v['end'] + 1):
                e['notes'].extend(notes.get(n, []))
            out.append(e)
    return out


def prose_tokens(lines):
    """Token stream over prose lines (no Devanagari) -> [(tok, line_index)]"""
    out = []
    for i, l in enumerate(lines):
        if len(re.findall(r'[\u0900-\u097F]', l['text'])) >= 3 or l['kind'] == 'SKT':
            continue
        for t in toks(l['text']):
            out.append((t, i))
    return out


def anchor(lines, entries, k=3):
    """n-gram voting + monotone chaining.  Returns one record per entry."""
    from collections import Counter, defaultdict
    pt = prose_tokens(lines)
    words = [t for t, _ in pt]
    idx = defaultdict(list)
    for i in range(len(words) - k + 1):
        idx[tuple(words[i:i + k])].append(i)
    cands = []
    for e in entries:
        S = toks(e['text'])
        votes = Counter()
        for j in range(len(S) - k + 1):
            ps = idx.get(tuple(S[j:j + k]), [])
            if len(ps) > 40:
                continue
            for p in ps:
                votes[(p - j) // 4] += 1
        cs = []
        for b, v in votes.most_common(6):
            cs.append((b * 4, v))
        cands.append((S, cs))
    # DP: choose at most one candidate per entry, strictly increasing positions, max total votes
    best = []   # list of (score, pos, back) per entry per cand
    n = len(entries)
    flat = []
    for ei, (S, cs) in enumerate(cands):
        for pos, v in cs:
            if v >= 2:
                flat.append((ei, pos, v))
    flat.sort(key=lambda x: (x[0], x[1]))
    # O(F^2) DP is fine (F ~ 4000)
    score = [0] * len(flat)
    back = [-1] * len(flat)
    for i, (ei, pos, v) in enumerate(flat):
        score[i] = v
        for j in range(i - 1, -1, -1):
            ej, pj, vj = flat[j]
            if ej < ei and pj < pos and score[j] + v > score[i]:
                score[i] = score[j] + v
                back[i] = j
    chosen = {}
    if flat:
        i = max(range(len(flat)), key=lambda x: score[x])
        while i >= 0:
            chosen[flat[i][0]] = flat[i][1]
            i = back[i]
    res = []
    for ei, e in enumerate(entries):
        S = cands[ei][0]
        if ei not in chosen:
            res.append({'entry': e, 'score': 0.0, 'tok': None})
            continue
        p0 = max(0, chosen[ei] - 8)
        seg = words[p0:p0 + len(S) + 30]
        sm = difflib.SequenceMatcher(None, seg, S, autojunk=False)
        blocks = [b for b in sm.get_matching_blocks() if b.size]
        # first/last matched tokens (ignore isolated 1-token matches at the edges)
        good = [b for b in blocks if b.size >= 2] or blocks
        st = p0 + good[0].a - good[0].b if good[0].b <= 3 else p0 + good[0].a
        st = max(st, p0 + good[0].a - good[0].b)
        en = p0 + good[-1].a + good[-1].size - 1 + (len(S) - good[-1].b - good[-1].size if len(S) - good[-1].b - good[-1].size <= 3 else 0)
        en = min(en, len(words) - 1)
        st = max(0, min(st, en))
        ratio = difflib.SequenceMatcher(None, words[st:en + 1], S, autojunk=False).ratio()
        res.append({'entry': e, 'score': ratio, 'tok': (st, en), 'lines': (pt[st][1], pt[en][1])})
    return res


if __name__ == '__main__':
    lines = classify(load_pages())
    ents = book_entries()
    res = anchor(lines, ents)
    bad = [r for r in res if r['tok'] is None or r['score'] < 0.8]
    print('entries', len(ents), 'anchored', sum(1 for r in res if r['tok']), 'weak/missing', len(bad))
    for r in bad:
        e = r['entry']
        print(' ', e['ch'], e['start'], e['end'], round(r['score'], 2), e['text'][:60])
