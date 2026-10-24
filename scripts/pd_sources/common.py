"""Shared helpers: hOCR parsing, DB access, text utilities."""
import html, json, os, re, sqlite3, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import DB

_PAGE = re.compile(r"""<div class=['"]ocr_page['"][^>]*title=['"]([^'"]*)['"]""")
_TITLE_BBOX = re.compile(r'bbox (\d+) (\d+) (\d+) (\d+)')


def _attr(title, key):
    m = re.search(key + r' ([\d.\-]+)', title)
    return float(m.group(1)) if m else None


def parse_hocr(path_or_text, page_offset=0):
    """Yield page dicts {idx, w, h, lines:[{bbox, x_size, par, words:[{t,bbox,conf}]}]}.

    Works for both ABBYY-derived archive.org hOCR and tesseract hOCR."""
    h = path_or_text
    if os.path.exists(path_or_text):
        h = open(path_or_text, encoding='utf-8').read()
    starts = [m.start() for m in re.finditer(r"""<div class=['"]ocr_page['"]""", h)]
    starts.append(len(h))
    pages = []
    for pi in range(len(starts) - 1):
        ph = h[starts[pi]:starts[pi + 1]]
        title = re.search(r"title=(['\"])(.*?)\1", ph).group(2)
        title = html.unescape(title)
        bb = [int(x) for x in _TITLE_BBOX.search(title).groups()]
        page = {'idx': pi + page_offset, 'w': bb[2], 'h': bb[3], 'lines': []}
        par_id = None
        for m in re.finditer(r"""<p class=['"]ocr_par['"][^>]*id=['"]([^'"]+)['"]|<span class=['"](?:ocr_line|ocr_caption|ocr_textfloat|ocr_header)['"][^>]*title=['"]([^'"]*)['"][^>]*>(.*?)(?=<span class=['"](?:ocr_line|ocr_caption|ocr_textfloat|ocr_header)['"]|<p class=|</div>\s*<div class=['"]ocr_carea|$)""", ph, flags=re.S):
            if m.group(1):
                par_id = m.group(1)
                continue
            lt = html.unescape(m.group(2))
            words = []
            for w in re.finditer(r"""<span class=['"]ocrx_word['"][^>]*title=['"]([^'"]*)['"][^>]*>(.*?)</span>""", m.group(3), flags=re.S):
                wt = html.unescape(re.sub(r'<[^>]+>', '', w.group(2))).strip()
                if not wt:
                    continue
                wb = [int(x) for x in _TITLE_BBOX.search(w.group(1)).groups()]
                words.append({'t': wt, 'bbox': wb, 'conf': _attr(w.group(1), 'x_wconf')})
            if not words:
                continue
            lb = [int(x) for x in _TITLE_BBOX.search(lt).groups()]
            page['lines'].append({'bbox': lb, 'x_size': _attr(lt, 'x_size'), 'par': par_id, 'words': words,
                                  'text': ' '.join(w['t'] for w in words)})
        pages.append(page)
    return pages


def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def verse_counts():
    con = db()
    return {r[0]: r[1] for r in con.execute('select chapter, count(*) from verses group by chapter')}


DEV_RE = re.compile(r'[ऀ-ॿ]')


def is_dev(s):
    return bool(DEV_RE.search(s))


def nfc(s):
    return unicodedata.normalize('NFC', s)


def write_json(path, obj):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')


def load_english_words():
    words = set()
    for p in ('/usr/share/dict/words', '/usr/share/dict/web2'):
        if os.path.exists(p):
            with open(p, encoding='utf-8', errors='ignore') as f:
                words.update(w.strip().lower() for w in f)
    return words


def vkey(c, v):
    return '%d.%d' % (c, v)
