"""Swami Swarupananda, Srimad-Bhagavad-Gita (1909): word-for-word, translation, notes -> JSON.

Run after fetch.py and ocr_sw.py.  Writes
  scripts/out/pd_sources/swarupananda_wbw.json
  scripts/out/pd_sources/swarupananda_translation.json
  scripts/out/pd_sources/_cache/sw_debug.json   (per-unit diagnostics used by review/report)
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import OUT, CACHE, SW_ID
from common import load_english_words, write_json, verse_counts, is_dev
import sacred
from sw_regions import build
from sw_layout import dev_ratio
from textfix import join_lines, correct, ref_vocab_of, tidy, ntok
import sw_wbw
import witness

COUNTS = verse_counts()


def our_verses(ch, a, b):
    """Book numbering -> our (701-verse) numbering."""
    if ch == 13:                       # the book omits Arjuna's question (our 13.1)
        a, b = a + 1, b + 1
    if ch == 1 and a == 27 and b == 27:
        return [(1, 27), (1, 28)]      # book 27 = our 27 + first half of 28
    if ch == 1 and a == 29 and b == 29:
        return [(1, 28), (1, 29)]      # book 29 = second half of 28 + 29
    return [(ch, v) for v in range(a, b + 1) if v <= COUNTS[ch]]


def vocabularies():
    eng = load_english_words()
    corpus = set()
    for c, (vs, notes) in sacred.load().items():
        for v in vs:
            corpus.update(ntok(w) for w in v['text'].split())
        for ns in notes.values():
            for n in ns:
                corpus.update(ntok(w) for w in n.split())
    corpus.discard('')
    SHORT = set('a i o an as at be by do he if in is it me my no of oh on or so to up us we ye am go lo'.split())
    small = set(w for w in corpus if len(w) > 2 or w in SHORT) | set(w for w in eng if len(w) >= 4)
    small -= {'cf', 'tara'}
    full = set(corpus) | eng
    return small, full


def nonwords(text, vocab):
    out = []
    for w in (text or '').split():
        core = re.sub(r"^[^A-Za-z\u00c0-\u017f]+|[^A-Za-z\u00c0-\u017f]+$", '', w)
        if not core:
            if re.search(r'[^\s.,;:!?()\[\]"\'\-\u2014]', w):
                out.append(w)
            continue
        parts = [p for p in re.split(r"[-'\u2014]", core) if p]
        if not all(ntok(p) in vocab or len(ntok(p)) <= 1 and p in ('a', 'A', 'I', 'O', 's') for p in parts):
            out.append(w)
    return out


def strip_brackets(s):
    s = s.strip()
    s = re.sub(r'^[\[\|\{lI1]\s*', '', s) if re.match(r'^[\[\|\{]', s) else s
    s = re.sub(r'\s*[\]\|\}]\s*$', '', s)
    return s.strip()


def main():
    small, full = vocabularies()
    lines, regs = build(small)
    wit = witness.Witness(small)
    trans_out, wbw_out, debug = {}, {}, []
    for rec in regs:
        e = rec['entry']
        vs = our_verses(e['ch'], e['start'], e['end'])
        d = {'book': '%d.%d%s' % (e['ch'], e['start'], '-%d' % e['end'] if e['end'] != e['start'] else ''),
             'verses': ['%d.%d' % v for v in vs], 'anchored': rec['anchored'], 'score': round(rec['score'], 3)}
        debug.append(d)
        if not rec['anchored'] or rec.get('coverage', 0) < 0.45:
            d['status'] = 'missing-in-scan'
            continue
        if rec.get('spans_missing_page') or rec.get('starts_after_gap'):
            d['status'] = 'incomplete (page missing from scan)'
            continue
        d['pages'] = rec['pages']
        d['lines'] = {k: [[lines[i]['page'], lines[i]['bbox']] for i in rec[k]] for k in ('wbw_lines', 'trans_lines', 'note_lines')}
        # ---------------- translation
        ocr_tr = join_lines([lines[i]['text'] for i in rec['trans_lines']], full, ref_vocab_of([e['text']]))
        tr, st = correct(ocr_tr, e['text'], small)
        d['trans_ocr'] = ocr_tr
        d['trans_stats'] = {k: v for k, v in st.items() if k != 'variants'}
        d['trans_variants'] = st['variants']
        nvar = st['variant']
        bad_t = nonwords(tr, small)
        d['trans_nonwords'] = bad_t
        if nvar == 0 and not bad_t:
            tconf = 'high'
        elif not bad_t:
            tconf = 'medium'        # wording differs from the later-edition transcription, scan reading kept
        else:
            tconf = 'low'
        # ---------------- notes
        notes_txt = None
        nconf = None
        if rec['note_lines']:
            ocr_n = join_lines([lines[i]['text'] for i in rec['note_lines']], full,
                               ref_vocab_of(e['notes']))
            ocr_n = strip_brackets(ocr_n)
            ref_n = re.sub(r'_', '', ' '.join(e['notes']))
            d['notes_ocr'] = ocr_n
            if ref_n:
                nt, nst = correct(ocr_n, ref_n, small)
                d['notes_stats'] = {k: v for k, v in nst.items() if k != 'variants'}
                d['notes_variants'] = nst['variants']
                bad_n = nonwords(nt, small)
                d['notes_nonwords'] = bad_n
                if nst['variant'] == 0 and not bad_n:
                    notes_txt, nconf = nt, 'high'
                elif len(bad_n) <= 1:
                    notes_txt, nconf = nt, 'medium'
                else:
                    notes_txt, nconf = None, 'low'      # too noisy to ship; raw text in _cache/sw_debug.json
                    d['notes_low'] = nt
            else:
                d['notes_stats'] = None
        # ---------------- word for word
        words = []
        for i in rec['wbw_lines']:
            words.extend(lines[i]['words'])
        # drop a trailing English speaker line ("Arjuna said:") and leading non-gloss lines
        wl = [lines[i]['text'] for i in rec['wbw_lines']]
        d['wbw_ocr'] = wl
        cut = len(rec['wbw_lines'])
        for k in range(len(rec['wbw_lines']) - 1, -1, -1):
            t = lines[rec['wbw_lines'][k]]['text']
            if re.search(r'said\s*[:;.]?\s*$', t) and dev_ratio(t) < 0.05 and len(t) < 40:
                cut = k
                break
            if k < len(rec['wbw_lines']) - 1:
                break
        wlines = rec['wbw_lines'][:cut]
        wit_gloss = wit.glosses(e)
        wset = wit.wset(wit_gloss)
        words = witness.merge_hyphens([lines[i]['words'] for i in wlines], small, wset)
        words = sw_wbw.prepare_tokens(words, small, wset)
        words = witness.fix_tokens(words, wit_gloss, small)
        labs = sw_wbw.label_tokens(words, small, wset)
        pairs = sw_wbw.pairs_from(words, labs)
        pairs = [p for p in pairs if p['H'] or p['E']]
        # a leading pair without headword whose "gloss" has no real words is debris (label, specks)
        while pairs and not pairs[0]['H'] and not any(re.sub(r'[^a-z]', '', w['t'].lower()) in small and len(w['t']) > 2 for w in pairs[0]['E']):
            pairs = pairs[1:]
        matched, uncovered = sw_wbw.match_pairs(pairs, vs)
        # an unresolved "headword" that is really an English word (mis-labelled gloss text, e.g. the
        # "touch" of "the (organ of) touch") is folded back into the preceding gloss
        merged = []
        for p, c, how, sc in matched:
            hw = [w['t'] for w in p['H']]
            if c is None and merged and hw and all(not is_dev(x) and re.sub(r'[^a-z]', '', x.lower()) in small and
                                                    (x[:1].islower() or x[:1] == '(') and len(re.sub(r'[^a-z]', '', x.lower())) > 2
                                                    for x in hw) and (all(wset and re.sub(r'[^a-z]', '', x.lower()) in wset for x in hw)
                                                                      or not any(is_dev(w.get('alt') or '') for w in p['H'])):
                q = merged[-1]
                merged[-1] = (dict(q[0], E=q[0]['E'] + p['H'] + p['E']), q[1], q[2], q[3])
                continue
            merged.append((p, c, how, sc))
        matched = merged
        items = []
        for p, c, how, sc in matched:
            g = sw_wbw.clean_gloss(p['E'], full)
            items.append({'p': p, 'c': c, 'how': how, 'score': sc, 'gloss': g,
                          'ocr_head': ' '.join(w['t'] for w in p['H'])})
        items, gstats = witness.fix_glosses(items, wit_gloss, small)
        for it in items:
            it['gloss'] = witness.restore_accents(it['gloss'], wit.accent_map)
        d['wbw_gloss_stats'] = gstats
        # assign verse per item
        lastv = vs[0]
        per = {v: [] for v in vs}
        for it in items:
            v = it['c']['verse'] if it['c'] and it['c']['verse'] else lastv
            lastv = v
            per[v].append(it)
        nh = len(items)
        n_dev = sum(1 for it in items if it['how'] == 'dev')
        n_guess = sum(1 for it in items if it['how'] in ('gloss', 'elimination'))
        n_unres = sum(1 for it in items if it['c'] is None)
        d['wbw_counts'] = {'pairs': nh, 'dev': n_dev, 'guessed': n_guess, 'unresolved': n_unres,
                           'uncovered_words': len(uncovered)}
        d['wbw_items'] = [{'ocr_head': it['ocr_head'], 'term_dev': it['c']['dev_disp'] if it['c'] else None,
                           'how': it['how'], 'score': it['score'], 'gloss': it['gloss'],
                           'gloss_fixed': it.get('fixed', [])} for it in items]
        for v in vs:
            key = '%d.%d' % v
            # translation
            if tr:
                trans_out[key] = {'text': tr, 'notes': notes_txt, 'confidence': tconf,
                                  'notes_confidence': nconf, 'book_verse': d['book'],
                                  'range': d['book'] if len(vs) > 1 else None,
                                  'pdf_pages': rec['pages']}
            its = per[v]
            if not its:
                continue
            nd = sum(1 for it in its if it['how'] in ('dev', 'supplied'))
            ng = sum(1 for it in its if it['how'] in ('gloss', 'elimination'))
            nu = sum(1 for it in its if it['c'] is None)
            ngbad = sum(1 for it in its if it.get('gloss_bad'))
            unc_v = [u for u in uncovered if u[0] == v]
            weak = sum(1 for it in its if it['how'] == 'dev' and it['score'] < 0.75)
            ng += weak                       # a weak Devanagari match counts as a guess
            # implausible glosses: empty, starting with punctuation, unbalanced brackets, a lone function word
            # for a content word -> signs of a mis-segmented pair
            FUNC = {'of', 'and', 'the', 'to', 'in', 'by', 'a', 'an', 'is', 'or', 'with'}
            odd = 0
            for it in its:
                g = it['gloss'].strip()
                core = re.sub(r'[^A-Za-z ]', '', g).strip().lower()
                if not core or re.match(r'^[,.;:)\]]', g) or g.count('(') != g.count(')'):
                    odd += 1
                elif core in FUNC and it['c'] and len(it['c']['idxs']) >= 1 and it['c']['dev'] not in ('च', 'तु', 'वा', 'अपि', 'हि', 'एव'):
                    if core not in ('and',) and core != 'of' or True:
                        odd += 1 if core in ('of', 'the', 'a', 'an', 'to', 'by', 'in', 'with', 'is') else 0
            d.setdefault('odd_glosses', {})[key] = odd
            if nu == 0 and ng <= 1 and ngbad == 0 and len(unc_v) <= 1 and weak == 0 and odd == 0:
                conf = 'high'
            elif nu <= 1 and (ng + nu) <= max(1, len(its) * 15 // 100) and ngbad <= 1 and len(unc_v) <= 3 and odd == 0:
                conf = 'medium'
            else:
                conf = 'low'
            wbw_out[key] = {
                'confidence': conf,
                'matched': nd, 'guessed': ng, 'unresolved': nu, 'uncovered_db_words': len(unc_v),
                'book_unit': d['book'],
                'words': [{'term_dev': it['c']['dev_disp'] if it['c'] else None,
                           'term_iast': it['c']['iast'] if it['c'] else None,
                           'meaning': it['gloss'],
                           'match': it['how'] or 'unresolved'} for it in its],
            }
    src = ('Swami Swarupananda, Srimad-Bhagavad-Gita, with Sanskrit text, paraphrase with word-by-word literal '
           'translation, English rendering and comments. First edition, Prabuddha Bharata Press, Mayavati, '
           'Almora, 1909 (Himalayan Series No. XX). Scan: archive.org/details/%s (Digital Library of India).' % SW_ID)
    order = lambda k: tuple(int(x) for x in k.split('.'))
    keys = sorted(wbw_out, key=order)
    write_json(os.path.join(OUT, 'swarupananda_wbw.json'),
               {'source': src, 'license': 'Public domain',
                'verses': {k: wbw_out[k] for k in keys if wbw_out[k]['confidence'] != 'low'}})
    write_json(os.path.join(OUT, 'swarupananda_wbw_low.json'),
               {'source': src, 'license': 'Public domain',
                'note': 'Low-confidence parses kept apart for manual proofreading against the scan; do not ship as is.',
                'verses': {k: wbw_out[k] for k in keys if wbw_out[k]['confidence'] == 'low'}})
    keys = sorted(trans_out, key=order)
    write_json(os.path.join(OUT, 'swarupananda_translation.json'), {k: trans_out[k] for k in keys if trans_out[k]['confidence'] != 'low'})
    write_json(os.path.join(OUT, 'swarupananda_translation_low.json'), {k: trans_out[k] for k in keys if trans_out[k]['confidence'] == 'low'})
    write_json(os.path.join(CACHE, 'sw_debug.json'), debug)
    print('translation verses', len(trans_out), 'wbw verses', len(wbw_out))


if __name__ == '__main__':
    main()
