"""Merge the archive.org (ABBYY) OCR of the Mahadeva Sastri scan with our tesseract OCR.

For every ABBYY line we collect the tesseract words that fall inside the same box on the same
page, align the two token sequences, and replace an ABBYY token by the tesseract token only when the
ABBYY token is not a known word (English dictionary / the book's own vocabulary) and the tesseract
token is.  Page correspondence (the hOCR has a few more leaves than the PDF) is found by text
similarity.
"""
import difflib, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import CACHE
from common import parse_hocr
from textfix import ntok
import ms_lexicon

TESS = os.path.join(CACHE, 'ms_tess')


class Merger:
    def __init__(self, abbyy_pages, vocab, lex):
        self.vocab, self.lex = vocab, lex
        self.tess = {}
        if os.path.isdir(TESS):
            for f in sorted(os.listdir(TESS)):
                if f.endswith('.hocr'):
                    self.tess[int(f[1:5])] = parse_hocr(os.path.join(TESS, f))[0]
        self.map = self._map_pages(abbyy_pages) if self.tess else {}
        self.stats = {'lines': 0, 'tokens_replaced': 0}

    def _map_pages(self, ap):
        def bag(pg):
            return set(ntok(w['t']) for l in pg['lines'] for w in l['words'] if len(ntok(w['t'])) > 3)
        tb = {k: bag(v) for k, v in self.tess.items()}
        out = {}
        off = 0
        for pg in ap:
            a = bag(pg)
            if len(a) < 15:
                continue
            best, bk = 0.0, None
            for d in range(-8, 9):
                k = pg['idx'] + 1 + off + d
                if k in tb and tb[k]:
                    j = len(a & tb[k]) / float(len(a | tb[k]))
                    if j > best:
                        best, bk = j, k
            if bk is not None and best > 0.3:
                out[pg['idx']] = (bk, pg['w'], pg['h'])
                off = bk - pg['idx'] - 1
        return out

    def tess_line(self, page_idx, bbox):
        m = self.map.get(page_idx)
        if not m:
            return None
        k, aw, ah = m
        tp = self.tess[k]
        sx, sy = tp['w'] / float(aw), tp['h'] / float(ah)
        x0, y0, x1, y1 = bbox[0] * sx, bbox[1] * sy, bbox[2] * sx, bbox[3] * sy
        ws = []
        for l in tp['lines']:
            for w in l['words']:
                cx = (w['bbox'][0] + w['bbox'][2]) / 2.0
                cy = (w['bbox'][1] + w['bbox'][3]) / 2.0
                if x0 - 15 <= cx <= x1 + 15 and y0 - 6 <= cy <= y1 + 6:
                    ws.append(w)
        ws.sort(key=lambda w: w['bbox'][0])
        return ws

    def merge(self, page_idx, bbox, text):
        tw = self.tess_line(page_idx, bbox)
        if not tw:
            return text
        self.stats['lines'] += 1
        A = text.split()
        B = [self._norm(w['t']) for w in tw]
        ba = sum(1 for x in A if self._bad(x))
        bb = sum(1 for x in B if self._bad(x))
        if A and B and ba >= max(2, 0.25 * len(A)) and bb <= 0.34 * ba and 0.6 <= len(B) / float(len(A)) <= 1.6:
            self.stats['lines_replaced'] = self.stats.get('lines_replaced', 0) + 1
            return ' '.join(B)                    # ABBYY line is garbage, tesseract line is clean
        na, nb = [ntok(x) for x in A], [ntok(x) for x in B]
        sm = difflib.SequenceMatcher(None, na, nb, autojunk=False)
        out = list(A)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op != 'replace':
                continue
            if i2 - i1 == j2 - j1:
                for k in range(i2 - i1):
                    a, b = A[i1 + k], B[j1 + k]
                    sim = difflib.SequenceMatcher(None, ntok(a), ntok(b)).ratio()
                    if self._bad(a) and not self._bad(b) and (sim >= 0.5 or (len(ntok(a)) >= 4 and sim >= 0.4)):
                        out[i1 + k] = b
                        self.stats['tokens_replaced'] += 1
            else:
                seg_a, seg_b = A[i1:i2], B[j1:j2]
                if all(self._bad(x) for x in seg_a if ntok(x)) and not any(self._bad(x) for x in seg_b) and \
                        difflib.SequenceMatcher(None, ''.join(na[i1:i2]), ''.join(nb[j1:j2])).ratio() >= 0.5:
                    for k in range(i1, i2):
                        out[k] = None
                    out[i1] = ' '.join(seg_b)
                    self.stats['tokens_replaced'] += len(seg_b)
        return ' '.join(x for x in out if x)

    @staticmethod
    def _norm(t):
        # tesseract renders the book's a-circumflex as "éa"/"é"/"â"; the output uses plain letters
        t = t.replace('éa', 'a').replace('éa', 'a').replace('â', 'a').replace('î', 'i').replace('û', 'u')
        t = re.sub(r'(?<=[a-z])é(?=[a-z])', 'a', t)
        return t

    def _bad(self, w):
        core = re.sub(r"^[\(\[\"'‘“]+|[\)\]\"'’”,.;:!?]+$", '', w)
        if not re.search(r'[A-Za-z]', core):
            return False
        if re.search(r'[A-Za-z]' + ms_lexicon.GARB + r'+[A-Za-z]', core) or re.search(r'[a-z][A-Z]', core):
            return True
        return not ms_lexicon.known(core.replace('-', ''), self.vocab, self.lex) and \
            not all(ms_lexicon.known(p, self.vocab, self.lex) for p in core.split('-') if p)
