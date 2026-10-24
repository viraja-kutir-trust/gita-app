"""Layout analysis of the Swarupananda 1909 scan.

Builds one reading-order stream of lines from our tesseract (eng+san) re-OCR, attaches to every
word the overlapping word of the DLI OCR shipped with the scan (second witness), drops running
heads / page numbers / specks, classifies lines and cuts the stream into book units:

    unit = Sanskrit verse lines (large type)  ->  centred label "II. 47."  ->  body lines
           (word-for-word paraphrase, English rendering, bracketed comments)
"""
import os, pickle, re, statistics, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import CACHE, SW_TESS
from common import parse_hocr, is_dev, DEV_RE

PKL = os.path.join(CACHE, 'sw_lines.pkl')


def _iou(a, b):
    x0, y0, x1, y1 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    if x1 <= x0 or y1 <= y0:
        return 0.0
    i = (x1 - x0) * (y1 - y0)
    return i / float((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i)


def dev_ratio(s):
    d = len(DEV_RE.findall(s))
    l = len(re.findall(r'[A-Za-z]', s))
    return d / float(d + l) if d + l else 0.0


def _attach(words, others, key):
    for w in words:
        best, bi = None, 0.25
        for dw in others:
            if dw['bbox'][3] < w['bbox'][1] or dw['bbox'][1] > w['bbox'][3]:
                continue
            v = _iou(w['bbox'], dw['bbox'])
            if v > bi:
                best, bi = dw, v
        w[key] = best['t'] if best else None


def load_pages():
    if os.path.exists(PKL):
        return pickle.load(open(PKL, 'rb'))
    dli = parse_hocr(os.path.join(CACHE, 'sw_hocr.html'))
    extra = {}
    for tag in ('san', 'Devanagari'):
        d = SW_TESS + '_' + tag
        if os.path.isdir(d):
            extra[tag] = d
    extra = dict(extra)
    # primary reading: the pre-processed (2x, smoothed) tesseract run if present, else the plain run
    prim = SW_TESS + '_prep' if os.path.isdir(SW_TESS + '_prep') and \
        len([f for f in os.listdir(SW_TESS + '_prep') if f.endswith('.hocr')]) >= len([f for f in os.listdir(SW_TESS) if f.endswith('.hocr')]) else SW_TESS
    # the smoothed run reads Devanagari better but English worse: keep the plain run primary
    if prim != SW_TESS:
        extra['orig'] = prim            # attached as 'alt_orig' (second Latin+Devanagari reading)
        prim = SW_TESS
    files = sorted(f for f in os.listdir(prim) if f.endswith('.hocr'))
    pages = []
    for f in files:
        pno = int(f[1:5])                      # 1-based PDF page
        pg = parse_hocr(os.path.join(prim, f))[0]
        pg['pdf_page'] = pno
        dwords = [w for l in dli[pno - 1]['lines'] for w in l['words']] if pno - 1 < len(dli) else []
        for l in pg['lines']:
            for w in l['words']:
                best, bi = None, 0.25
                for dw in dwords:
                    if dw['bbox'][3] < w['bbox'][1] or dw['bbox'][1] > w['bbox'][3]:
                        continue
                    v = _iou(w['bbox'], dw['bbox'])
                    if v > bi:
                        best, bi = dw, v
                w['alt'] = best['t'] if best else None
        for tag, d in extra.items():
            f2 = os.path.join(d, f)
            if os.path.exists(f2):
                ow = [w for l in parse_hocr(f2)[0]['lines'] for w in l['words']]
                _attach([w for l in pg['lines'] for w in l['words']], ow, 'alt_' + tag)
        pages.append(pg)
    pickle.dump(pages, open(PKL, 'wb'))
    return pages


HEAD_RE = re.compile(r'(SRIMAD|BHAGAVAD|GITA|CHAP|Chap|WAY|GRIEF|KNOWLEDGE|VISION|GLIMPSES|DISCRIMINATION|'
                     r'CLASSIFICATION|ENQUIRY|LIBERATION|DEVOTION|MEDITATION|RENUNCIATION|ACTION|IMPERISHABLE|'
                     r'SUPREME|KINGLY|DIVINE|GUNAS|KSHETRA)')


def classify(pages):
    """Return flat list of kept lines with 'kind' in SKT / LABEL / TXT."""
    out = []
    for pg in pages:
        lines = pg['lines']
        sizes = [l['x_size'] for l in lines if l['x_size'] and not is_dev(l['text'])]
        body = statistics.median(sizes) if sizes else 75
        first_text = True
        for l in lines:
            t = l['text'].strip()
            x0, y0, x1, y1 = l['bbox']
            nlet = len(re.findall(r'[A-Za-z0-9ऀ-ॿ]', t))
            if nlet < 3 or (l['x_size'] or 0) < 45:
                continue                       # specks, stray marks
            if first_text and y0 < 700:
                first_text = False
                if HEAD_RE.search(t) or re.match(r'^\W*\d+\W*$', t):
                    continue                   # running head
            first_text = False
            if y0 > pg['h'] - 350 and re.match(r'^\W*\d{1,3}\W*$', t):
                continue                       # foot page number
            dr = dev_ratio(t)
            kind = 'TXT'
            if (l['x_size'] or 0) >= 92 and (dr >= 0.45 or '॥' in t):
                kind = 'SKT'
            elif (l['x_size'] or 0) >= 92 and dr >= 0.2 and len(t) < 60:
                kind = 'SKT'
            elif x0 > 750 and x1 < 1600 and len(t.split()) <= 4 and \
                    re.search(r'\d|[a-z]{1,2}\.', t) and len(t) <= 16:
                kind = 'LABEL'
            l2 = dict(l)
            l2.update(kind=kind, page=pg['pdf_page'], body=body, pw=pg['w'])
            out.append(l2)
    return out


def units(lines):
    """Cut the classified stream into units [{skt:[..], label: line|None, body:[..]}]."""
    us = []
    cur = None
    for l in lines:
        if l['kind'] == 'SKT':
            if cur is None or cur['body'] or cur['label'] is not None:
                cur = {'skt': [], 'label': None, 'body': []}
                us.append(cur)
            cur['skt'].append(l)
        elif l['kind'] == 'LABEL' and cur is not None and not cur['body'] and cur['label'] is None:
            cur['label'] = l
        elif cur is not None and cur['skt'] and not cur['body'] and cur['label'] is None and dev_ratio(l['text']) >= 0.8:
            cur['skt'].append(l)               # verse line continued on next page / smaller type
        else:
            if cur is None:
                cur = {'skt': [], 'label': None, 'body': []}
                us.append(cur)
            cur['body'].append(l)
    return us


if __name__ == '__main__':
    pages = load_pages()
    ls = classify(pages)
    us = units(ls)
    print('lines', len(ls), 'units', len(us))
    for u in us[:12] + us[60:64]:
        print('----', u['skt'][0]['page'] if u['skt'] else '?', [l['text'][:40] for l in u['skt']],
              u['label']['text'] if u['label'] else None)
        for l in u['body'][:3]:
            print('     ', l['text'][:90])
