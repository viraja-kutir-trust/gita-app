"""Cut the 1909 OCR stream into per-unit regions using the translation anchors.

unit region = {entry, wbw_lines, trans_lines, note_lines, pages}
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sw_layout import load_pages, classify, dev_ratio
from sw_anchor import anchor, book_entries, toks
import difflib

ENG_SMALL = None


def _missing_after():
    """pdf page -> True if printed pages are missing right after it (from the DLI page map)."""
    import json
    from config import CACHE
    p = os.path.join(CACHE, 'sw_pages.json')
    d = json.load(open(p))
    nums = {}
    for pg in d['pages']:
        try:
            nums[pg['leafNum'] + 1] = int(pg['pageNumber'])
        except (ValueError, TypeError):
            pass
    out = {}
    for pdf, n in nums.items():
        if pdf + 1 in nums and nums[pdf + 1] - n > 1 and n > 0:
            out[pdf] = nums[pdf + 1] - n - 1
    return out


MISSING_AFTER = _missing_after()


def eng_count(text, vocab):
    n = 0
    for w in re.findall(r"[A-Za-z][a-z']+|\b[a-z]\b", text):
        if w.lower() in vocab and (w[0].islower() or len(w) > 2):
            n += 1
    return n


def is_label(l):
    t = l['text'].strip()
    x0, x1 = l['bbox'][0], l['bbox'][2]
    ndev = len(re.findall(r'[\u0900-\u097F]', t))
    cx = (x0 + x1) / 2.0
    centred = abs(cx - l.get('pw', 2300) / 2.0) < 360 and (x1 - x0) < 1000
    return (centred and len(t) <= 18 and len(t.split()) <= 4 and ndev <= 3 and
            re.search(r'\d|[IVX]{1,4}\.', t) is not None)


def skt_like(l, vocab):
    t = l['text']
    if l['kind'] == 'SKT' or '॥' in t:
        return True
    if (l['x_size'] or 0) >= 95 and dev_ratio(t) >= 0.3:
        return True
    return dev_ratio(t) >= 0.75 and eng_count(t, vocab) < 2


def regions(lines, res, vocab, coverage_min=0.8):
    out = []
    prev_end = -1
    for ri, r in enumerate(res):
        e = r['entry']
        rec = {'entry': e, 'score': r['score'], 'anchored': r['tok'] is not None}
        if r['tok'] is None:
            out.append(rec)
            continue
        a, b = r['lines']
        # coverage of the sacred text by OCR tokens
        S = toks(e['text'])
        ocr = toks(' '.join(lines[i]['text'] for i in range(a, b + 1) if len(re.findall(r'[\u0900-\u097F]', lines[i]['text'])) < 3))
        sm = difflib.SequenceMatcher(None, ocr, S, autojunk=False)
        cov = sum(x.size for x in sm.get_matching_blocks()) / float(max(1, len(S)))
        rec['coverage'] = cov
        rec['trans_lines'] = list(range(a, b + 1))
        # notes: prose lines after the translation up to the first Sanskrit-ish line
        nxt = res[ri + 1]['lines'][0] if ri + 1 < len(res) and res[ri + 1]['tok'] else len(lines)
        notes = []
        i = b + 1
        while i < nxt:
            l = lines[i]
            if l['kind'] == 'SKT' or dev_ratio(l['text']) >= 0.3:
                break
            notes.append(i)
            i += 1
        # notes must start with a bracket (comments are bracketed in this book)
        if notes and not re.match(r'^\s*[\[\|\{\(lI1]', lines[notes[0]]['text']):
            notes = []
        rec['note_lines'] = notes
        # gap -> word-for-word
        gap = list(range(prev_end + 1, a))
        lab = [i for i in gap if is_label(lines[i])]
        # a label is only trusted if Sanskrit-verse lines precede it
        lab = [i for i in lab if any(skt_like(lines[j], vocab) for j in gap if j < i)]
        sk = [i for i in gap if skt_like(lines[i], vocab)]
        if sk and lab and sk[-1] > lab[-1]:
            lab = []
        if lab:
            start = lab[-1] + 1
        else:
            start = gap[0] if gap else a
            for i in gap:
                if skt_like(lines[i], vocab):
                    start = i + 1
        rec['wbw_lines'] = [i for i in range(start, a)]
        rec['gap_lines'] = gap
        rec['label'] = lines[lab[-1]]['text'] if lab else None
        rec['has_skt'] = bool(sk) or bool(lab)
        rec['pages'] = sorted(set(lines[i]['page'] for i in rec['wbw_lines'] + rec['trans_lines'] + notes))
        span = [lines[i]['page'] for i in rec['wbw_lines'] + rec['trans_lines'] + notes]
        rec['spans_missing_page'] = any(MISSING_AFTER.get(p) for p in range(min(span), max(span))) if span else False
        # unit begins right after a missing page and shows no verse/label: its start is lost
        rec['starts_after_gap'] = (not rec['has_skt']) and bool(gap) and MISSING_AFTER.get(lines[gap[0]]['page'] - 1, False)
        out.append(rec)
        prev_end = (notes[-1] if notes else b)
    return out


def build(vocab):
    lines = classify(load_pages())
    ents = book_entries()
    res = anchor(lines, ents)
    return lines, regions(lines, res, vocab)


if __name__ == '__main__':
    from common import load_english_words
    import sacred
    vocab = load_english_words()
    lines, regs = build(vocab)
    for rec in regs:
        e = rec['entry']
        if (e['ch'], e['start']) in [(2, 47), (2, 2), (1, 1), (11, 36), (18, 66), (6, 5)]:
            print('=====', e['ch'], e['start'], e['end'], 'score', round(rec['score'], 2), 'cov', round(rec.get('coverage', 0), 2), rec.get('label'))
            for k in ('wbw_lines', 'trans_lines', 'note_lines'):
                print(' --', k)
                for i in rec.get(k, []):
                    print('    ', lines[i]['text'])
