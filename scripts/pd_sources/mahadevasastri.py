"""A. Mahadeva Sastri, The Bhagavad-Gita with the commentary of Sri Sankaracharya (2nd ed., Mysore 1901).

Source OCR: archive.org item bhagavadgitawith00maharich (ABBYY hOCR).  Writes
  scripts/out/pd_sources/mahadevasastri.json
  scripts/out/pd_sources/_cache/ms_debug.json

Layout used (per page): body text in one column; footnotes in smaller type (dropped); running head
in smaller type (dropped); verse translations set off with a numbered, doubly-indented paragraph;
Shankara's commentary in normal paragraphs; Sastri's italic side-headings centred (dropped, but kept
as boundaries: commentary after a side-heading introduces the next verse).
"""
import json, os, re, statistics, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import CACHE, OUT, MS_ID
from common import parse_hocr, write_json, verse_counts, load_english_words
from textfix import tidy, ntok
import ms_lexicon
import ms_merge

COUNTS = verse_counts()
ORD = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH', 'ELEVENTH',
       'TWELFTH', 'THIRTEENTH', 'FOURTEENTH', 'FIFTEENTH', 'SIXTEENTH', 'SEVENTEENTH', 'EIGHTEENTH']
HEAD_RE = re.compile(r'(GITA|GiTA|GlTA|BHAGAVAD|Dis\.|DiS\.|DIS\.|\[Dis|\]\s+[A-Z])')
NUM_MAP = str.maketrans({'I': '1', 'l': '1', 'i': '1', '|': '1', 'S': '8', 'g': '9', 'O': '0', 'o': '0', 'z': '2', 'Z': '2', 'B': '8', 's': '5'})
VSTART = re.compile(r'^\W{0,2}([0-9IlSgOoiz|]{1,3})(?:\s*[-—–~]\s*([0-9IlSgOoiz|]{1,3}))?\s*[.,:;]?\s+(?=\S)')


def parse_num(s):
    t = s.translate(NUM_MAP)
    return int(t) if t.isdigit() else None


def page_lines(pages):
    out = []
    chapter = 0
    for pg in pages:
        ls = pg['lines']
        if not ls:
            continue
        xs = [l['x_size'] for l in ls if l['x_size']]
        if not xs:
            continue
        body = statistics.median_high(xs)
        keep = [l for l in ls if (l['x_size'] or 0) >= 0.93 * body]
        # running head (sometimes split into several boxes: "2-4.]", "SANKHYA-YOGA.", "359")
        while keep and keep[0]['bbox'][1] < 330 and 'DISCOURSE' not in keep[0]['text'] and (HEAD_RE.search(keep[0]['text']) or
                                                      re.match(r'^[\W\dIVXLivxl—\-.\]\[ ]+$', keep[0]['text']) or
                                                      re.match(r'^[\W\d]*[A-Z][A-Z\-\' ]{4,}[.\W\d]*$', keep[0]['text'])):
            keep = keep[1:]
        if not keep:
            continue
        lefts = sorted(l['bbox'][0] for l in keep if (l['bbox'][2] - l['bbox'][0]) > 400)
        if not lefts:
            lefts = sorted(l['bbox'][0] for l in keep)
        # text-block edges: the outermost positions shared by at least two lines (ignores specks)
        L = next((x for x in lefts if sum(1 for y in lefts if abs(y - x) <= 14) >= 2), lefts[0])
        rights = sorted((l['bbox'][2] for l in keep), reverse=True)
        R = next((x for x in rights if sum(1 for y in rights if abs(y - x) <= 14) >= 2), rights[0])
        for l in keep:
            ws = list(l['words'])
            # stray specks / bar marks at either margin distort the indentation measure
            while len(ws) > 1 and len(ws[0]['t']) <= 2 and not re.fullmatch(r'[AIOa"\'(\d]|\d\.', ws[0]['t']) and ws[1]['bbox'][0] - ws[0]['bbox'][2] > 12:
                ws = ws[1:]
            while len(ws) > 1 and len(ws[-1]['t']) <= 2:
                gap = ws[-1]['bbox'][0] - ws[-2]['bbox'][2]
                tt = ws[-1]['t']
                if tt in ('|', 'l', '1', '!', '/', '\\') or (tt == 'I' and gap > 28) or \
                        (not re.fullmatch(r'[a-zA-Z]{1,2}[.,;:]?', tt) and gap > 20):
                    ws = ws[:-1]
                else:
                    break
            x0 = ws[0]['bbox'][0]
            l = dict(l, bbox=[ws[0]['bbox'][0], l['bbox'][1], ws[-1]['bbox'][2], l['bbox'][3]], text=' '.join(w['t'] for w in ws))
            t = l['text'].strip()
            m = re.match(r'^([A-Z]+)\s+DISCOURSE', t)
            if m and m.group(1) in ORD:
                chapter = ORD.index(m.group(1)) + 1
                out.append({'kind': 'CHAPTER', 'ch': chapter, 'text': t, 'page': pg['idx'], 'bbox': l['bbox']})
                continue
            ind, rg = x0 - L, R - l['bbox'][2]
            kind = 'TXT'
            if ind > 80 and rg > 80 and abs(ind - rg) < 90 and not VSTART.match(t) and re.match(r'^[\W]{0,2}[A-Z(]', t):
                kind = 'SPEAKER' if re.search(r'said\s*[:;.]?\s*$', t) else 'HEAD'
            if len(t) <= 2 and (l['bbox'][2] - l['bbox'][0]) < 90:
                continue                            # specks
            out.append({'kind': kind, 'ch': chapter, 'text': t, 'page': pg['idx'], 'bbox': l['bbox'],
                        'ind': ind, 'rg': rg, 'pw': R - L, 'par': l['par']})
    return out


def segment(lines):
    """-> list of items: ('verse', ch, a, b, [lines]) / ('para', ch, [lines]) / ('head', ch, text)"""
    items = []
    expected = {}
    i = 0
    n = len(lines)
    cur_para = None
    while i < n:
        l = lines[i]
        ch = l['ch']
        if l['kind'] == 'CHAPTER':
            items.append(('chapter', ch, l))
            cur_para = None
            i += 1
            continue
        if ch == 0:
            i += 1
            continue
        if l['kind'] in ('HEAD', 'SPEAKER'):
            items.append(('head' if l['kind'] == 'HEAD' else 'speaker', ch, l))
            cur_para = None
            i += 1
            continue
        exp = expected.get(ch, 1)
        fallback = False
        m = VSTART.match(l['text'])
        a = b = None
        if m and (l['ind'] >= 30 or (exp == 1 and l['ind'] >= 5)):
            a = parse_num(m.group(1))
            b = parse_num(m.group(2)) if m.group(2) else a
            maxv = COUNTS[ch] + (1 if ch == 13 else 0)
            ok = a is not None and b is not None and a <= b and b - a <= 4 and exp <= a <= exp + 2 and b <= maxv
            if not ok and a is not None and a < exp and a >= exp - 1 and b is not None and b >= exp:
                ok = True                          # overlapping groups printed by Sastri in Disc. I ("26-27", "27-28")
            if not ok:
                a = b = None
        if a is None and i + 1 < n and exp <= COUNTS[ch] + (1 if ch == 13 else 0):
            nx = lines[i + 1]
            geo = (l['ind'] >= 90 and nx['kind'] == 'TXT' and 25 <= nx['ind'] < 250 and nx['rg'] >= 30 and l['rg'] >= 30
                   and ch != 1 and not (ch == 2 and exp <= 10))
            mg = re.match(r'^(\S{1,4})[.,]?\s+(?=["\'‘“(A-Z\\])', l['text'])
            junk_num = mg and not re.fullmatch(r'[A-Za-z]{2,4}[.,]?', mg.group(1)) and not mg.group(1) in ('A', 'I', 'O')
            def next_num():
                for q in range(i + 1, min(n, i + 160)):
                    y = lines[q]
                    if y['ch'] != ch:
                        return None
                    my = VSTART.match(y['text'])
                    if my and y['ind'] >= 30:
                        v = parse_num(my.group(1))
                        if v is not None and exp <= v <= exp + 3:
                            return v
                return None
            if geo and l['text'][:1].isupper() and not junk_num and (lines[i - 1]['rg'] > 150 if i else False):
                if next_num() == exp + 1:
                    a = b = exp                    # verse number lost by OCR; geometry says verse
                    fallback = True
            elif junk_num and (geo or (l['ind'] >= 45 and (ch == 1 or (ch == 2 and exp <= 10)))):
                if next_num() in (exp + 1, None):
                    a = b = exp                    # verse number garbled by OCR ("^y." for 37)
                    fallback = True
        if a is not None:
            blk = [l]
            mode_b = ch == 1 or (ch == 2 and a <= 10)
            j = i + 1
            prev = l
            rgs = []
            while j < n:
                x = lines[j]
                if x['kind'] != 'TXT' or x['ch'] != ch:
                    break
                mv = VSTART.match(x['text'])
                if mv and x['ind'] >= 30:
                    a2 = parse_num(mv.group(1))
                    if a2 is not None and b < a2 <= b + 3:
                        break
                mj = re.match(r'^(\S{1,4})[.,]?\s+(?=["\'‘“(A-Z])', x['text'])
                if mode_b and mj and x['ind'] >= 45 and not re.fullmatch(r'[A-Za-z]{1,4}[.,]?', mj.group(1)) \
                        and not re.match(r'^[(\'"‘“]', mj.group(1)):
                    break                          # next verse with a garbled number
                if rgs and prev['rg'] > statistics.median(rgs) + 150:
                    break                          # previous line was the verse's short last line
                if not rgs and prev is not l and prev['rg'] > 250:
                    break
                if mode_b:
                    if prev['rg'] > 200 and prev['page'] == x['page']:
                        break
                else:
                    same_par = x['page'] == prev['page'] and x.get('par') == prev.get('par') and len(blk) < 12
                    if not (x['ind'] >= 25 and x['rg'] >= 30) and not same_par:
                        break                      # full-width line: commentary
                blk.append(x)
                if x['rg'] < 200:
                    rgs.append(x['rg'])
                prev = x
                j += 1
            btxt = ' '.join(x['text'] for x in blk)
            if fallback and re.search(r'(Up\.|Upanishad,|Ibid|Sutra|Smriti|Manu|Mund|Katha|Ka.ha|Svet|Bri\.|Chh\.|Tait|dharma,)\s*[\divx]', btxt):
                items.append(('para', ch, blk))     # an indented scripture quotation, not the verse
                cur_para = None
                i = j
                continue
            items.append(('verse', ch, a, b, blk))
            expected[ch] = b + 1
            cur_para = None
            i = j
            continue
        # commentary paragraph lines
        same_page = cur_para is not None and cur_para[-1]['page'] == l['page']
        new_par = cur_para is None or (l['ind'] >= 30 and l['ind'] < 150 and (not same_page or l['par'] != cur_para[-1]['par']
                                                                               or cur_para[-1]['rg'] > 120)) or \
            (same_page and cur_para[-1]['rg'] > 200 and l['ind'] >= 25)
        if cur_para is not None and l['page'] != cur_para[-1]['page']:
            last = cur_para[-1]['text'].rstrip()
            if l['ind'] < 30 or not re.search(r'[.?!:;"\')\u2014]\W{0,2}$', last) or last.endswith('-'):
                new_par = False                    # paragraph continued over the page break
        if new_par:
            cur_para = [l]
            items.append(('para', ch, cur_para))
        else:
            cur_para.append(l)
        i += 1
    return items


def join(lines, vocab, lex):
    out = ''
    for l in lines:
        t = l['text'].strip()
        if out.endswith('-') and not out.endswith('--'):
            m1 = re.search(r"([A-Za-z';/«»^]+)-$", out)
            m2 = re.match(r"([A-Za-z';/«»^]+)", t)
            if m1 and m2:
                j = ntok(m1.group(1) + m2.group(1))
                keep = (j not in vocab and j not in lex and m2.group(1)[:1].isupper()) or \
                       (ntok(m1.group(1)) in vocab and ntok(m2.group(1)) in vocab and j not in vocab and j not in lex)
                out = out[:-1] + ('-' if keep else '') + t
                continue
        out = (out + ' ' + t) if out else t
    return out


def clean(s, vocab, lex, stats):
    s = s.replace('—', ' — ').replace('—', ' — ')
    s = re.sub(r'(?<=\w)[*†‡§¶]+', '', s)          # footnote markers glued to words
    s = re.sub(r'(?:(?<=\s)|^)[*†‡§¶■•♦]+(?=\s|$)', ' ', s)
    s = re.sub(r"([.,;:!?\"'])\s*['\"]{2,}", r'\1"', s)
    toks = s.split()
    # footnote reference marks read as letters: "grief f ,", "For i ,", "words I of", "not. ^"
    keep = []
    for k, w in enumerate(toks):
        nxt = toks[k + 1] if k + 1 < len(toks) else ''
        if w in ('f', 't', '^', '+', '*', '§', '|', '\\', 'J', '■', '•', '♦', '£', '€', '\'\'', '"\'') :
            continue
        if w in ('f,', 't,', '^,', '+,', '*,', 'f.', 't.', 'f;', 't;', 'f:', 't:'):
            if keep:
                keep[-1] = keep[-1] + w[-1]
            continue
        if w == 'i' and (nxt[:1] in (',', ';', ':') or (nxt and nxt[:1].isalpha() and nxt[:1].islower())):
            continue
        if w == 'I' and keep and keep[-1][-1:].isalpha() and keep[-1][-1:].islower() and \
                (nxt.lower().strip(',.;:') in ('of', 'the', 'and', 'or', 'to', 'in', 'is', 'was', 'for', 'by', 'with', 'as', 'that', 'which', 'an') or nxt[:1] in (',', '.', ';', ':')):
            continue
        keep.append(w)
    toks = keep
    out = []
    for k, w in enumerate(toks):
        m = re.match(r"^([\(\[\"'‘“]*)([A-Za-z]{2,3})([\)\]\"'’”,.;:!?]*)$", w)
        if m and not ms_lexicon.known(m.group(2), vocab, lex):
            r = ms_lexicon.fix_short(toks[k - 1] if k else '', m.group(2), toks[k + 1] if k + 1 < len(toks) else '')
            if r:
                stats['tokens'] += 1
                stats['fixed'] += 1
                out.append(m.group(1) + (r.capitalize() if m.group(2)[0].isupper() else r) + m.group(3))
                continue
        out.append(ms_lexicon.fix_token(w, vocab, lex, stats))
    s = tidy(' '.join(out))
    s = s.replace(' — ', '—').replace('—', '—')
    s = re.sub(r'\s*—\s*', '—', s)
    s = re.sub(r':\s*—', ':—', s)
    s = re.sub(r'\(\s+', '(', s)
    s = re.sub(r'\s+\)', ')', s)
    return s


def our_keys(ch, a, b):
    if ch == 13:
        a, b = a + 1, b + 1
    return ['%d.%d' % (ch, v) for v in range(a, b + 1) if v <= COUNTS[ch]]


def main():
    vocab = load_english_words()
    lex = ms_lexicon.lexicon()
    pages = parse_hocr(os.path.join(CACHE, 'ms_hocr.html'))
    lines = page_lines(pages)
    merger = ms_merge.Merger(pages, vocab, lex)
    for l in lines:
        if l['kind'] == 'TXT':
            l['abbyy'] = l['text']
            l['text'] = merger.merge(l['page'], l['bbox'], l['text'])
    items = segment(lines)
    # group: verse -> following paragraphs until next verse; side-headings split commentary/introduction
    res = {}
    debug = []
    stats_all = {'tokens': 0, 'fixed': 0, 'unknown': 0}
    pending_intro = []
    vi = [k for k, it in enumerate(items) if it[0] == 'verse']
    for n_, k in enumerate(vi):
        it = items[k]
        _, ch, a, b, blk = it
        nxt = vi[n_ + 1] if n_ + 1 < len(vi) else len(items)
        between = items[k + 1:nxt]
        # commentary until the last side-heading/chapter marker; the rest introduces the next verse
        cut = len(between)
        for q in range(len(between) - 1, -1, -1):
            if between[q][0] in ('head', 'chapter'):
                cut = q
                break
        paras = [x for x in between[:cut] if x[0] == 'para']
        intro_next = [x for x in between[cut:] if x[0] == 'para']
        if cut == len(between):
            # no heading: a final short paragraph ending in ':' / ',' / '—' introduces the next verse
            if paras:
                last = ' '.join(l['text'] for l in paras[-1][2]).strip()
                if re.search(r'([:,;—-]|follows\s*\.?|says\s*\.?)\s*\W{0,3}$', last) and len(last) < 900:
                    intro_next = [paras[-1]]
                    paras = paras[:-1]
        st = {'tokens': 0, 'fixed': 0, 'unknown': 0, 'unknown_list': []}
        stt = {'tokens': 0, 'fixed': 0, 'unknown': 0, 'unknown_list': []}
        vt = join(blk, vocab, lex)
        mnum = VSTART.match(vt)
        vt2 = VSTART.sub('', vt, count=1) if mnum and parse_num(mnum.group(1)) is not None else vt
        if vt2 == vt:
            mj = re.match(r'^(\S{1,4})[.,]?\s+', vt)
            if mj and not re.fullmatch(r'[A-Za-z]{2,4}[.,]?', mj.group(1)) and mj.group(1) not in ('A', 'I', 'O'):
                vt2 = vt[mj.end():]
        vt = vt2
        trans = clean(vt, vocab, lex, stt)
        comm = [clean(join(p[2], vocab, lex), vocab, lex, st) for p in paras]
        intro = [clean(join(p[2], vocab, lex), vocab, lex, st) for p in pending_intro]
        comm = [c for c in comm if c]
        keys = our_keys(ch, a, b)
        rng = ('%d.%d-%d' % (ch, keys and int(keys[0].split('.')[1]), int(keys[-1].split('.')[1]))) if len(keys) > 1 else None
        unk = st['unknown'] / float(max(1, st['tokens']))
        tu = stt['unknown']
        tconf = 'high' if tu == 0 else ('medium' if tu <= 1 else 'low')
        cconf = 'high' if unk <= 0.005 else ('medium' if unk <= 0.02 else 'low')
        rankc = {'high': 2, 'medium': 1, 'low': 0}
        conf = min(tconf, cconf, key=lambda c: rankc[c])
        if trans.count('"') % 2:
            trans = re.sub(r'(?<=\w)"(?=[\s,;.]|$)', '', trans, count=1) if trans.count('"') == 1 else trans
        trans = re.sub(r"^['\"]\s+", '', trans)
        st['tokens'] += stt['tokens']; st['fixed'] += stt['fixed']; st['unknown'] += stt['unknown']
        rec = {'translation': trans, 'commentary': comm, 'introduction': intro or None, 'range': rng,
               'confidence': conf, 'translation_confidence': tconf, 'commentary_confidence': cconf,
               'translation_unreadable_words': stt['unknown_list'] or None, 'pages': sorted(set(l['page'] for l in blk) | set(l['page'] for p in paras for l in p[2]))}
        for key in keys:
            if key in res:          # overlapping groups in Disc. I: keep both renderings
                old = res[key]
                old['translation'] = old['translation'] + ' / ' + trans
                old['range'] = (old['range'] or key) + ' + ' + (rng or key)
                continue
            res[key] = dict(rec)
        debug.append({'book': '%d.%d%s' % (ch, a, '-%d' % b if b != a else ''), 'keys': keys, 'unknown': st['unknown_list'][:30],
                      'translation_unknown': stt['unknown_list'], 'commentary_unknown_rate': round(unk, 4),
                      'tokens': st['tokens'], 'fixed': st['fixed'], 'pages': rec['pages'],
                      'verse_bbox': [[l['page'], l['bbox']] for l in blk],
                      'comm_bbox': [[l['page'], l['bbox']] for p in paras for l in p[2]][:4],
                      'pdf_map': {str(pg): [merger.map[pg][0], merger.tess[merger.map[pg][0]]['w'] / float(merger.map[pg][1]),
                                            merger.tess[merger.map[pg][0]]['h'] / float(merger.map[pg][2])]
                                  for pg in set(l['page'] for l in blk) | set(l['page'] for p in paras[:1] for l in p[2]) if pg in merger.map}})
        for kk in ('tokens', 'fixed', 'unknown'):
            stats_all[kk] += st[kk]
        pending_intro = intro_next
    order = lambda k: tuple(int(x) for x in k.split('.'))
    out = {k: res[k] for k in sorted(res, key=order)}
    write_json(os.path.join(OUT, 'mahadevasastri.json'), {k: v for k, v in out.items() if v['translation_confidence'] != 'low'})
    write_json(os.path.join(OUT, 'mahadevasastri_low.json'), {k: v for k, v in out.items() if v['translation_confidence'] == 'low'})
    write_json(os.path.join(CACHE, 'ms_debug.json'), debug)
    missing = ['%d.%d' % (c, v) for c in range(1, 19) for v in range(1, COUNTS[c] + 1) if '%d.%d' % (c, v) not in out]
    print('verses', len(out), 'missing', len(missing), missing[:80])
    print('token stats', stats_all, 'merge', merger.stats, 'pages mapped', len(merger.map))


if __name__ == '__main__':
    main()
