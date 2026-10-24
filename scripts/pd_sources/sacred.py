"""Parse the sacred-texts.com transcription of Swarupananda's Gita (mirror at neonvagabond.xyz).

Returns, per chapter, the numbered translation paragraphs (book numbering, which may group
verses, e.g. "4-6.") and the footnotes (the book's bracketed comments), keyed by the verse number
printed in the footnote label "page:verse".
"""
import html, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import CACHE

CH_FILES = {c: 'sbg%02d.htm' % (c + 5) for c in range(1, 19)}


def _clean(s):
    s = re.sub(r'<span class="contnote">.*?</span>', ' ', s, flags=re.S)
    s = re.sub(r'<a name="page_\d+">.*?</A>', ' ', s, flags=re.S | re.I)
    s = re.sub(r'<A NAME="fr_\d+"></A><A HREF="#fn_\d+"><FONT SIZE="1">[^<]*</FONT></A>', ' ', s)
    s = re.sub(r'<i>(.*?)</i>', r'_\1_', s, flags=re.S | re.I)    # keep italics as _x_
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(s).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def parse_chapter(c):
    h = open(os.path.join(CACHE, 'sacred', CH_FILES[c]), encoding='utf-8', errors='replace').read()
    h = h[h.find('</h3>') if '</h3>' in h else 0:]
    fpos = h.find('Footnotes</H3>')
    body, foot = (h[:fpos], h[fpos:]) if fpos >= 0 else (h, '')
    body = body.split('<CENTER><A HREF')[0]
    # split into <p> paragraphs; merge "[paragraph continues]" pieces with previous
    paras = []
    for m in re.finditer(r'<p>(.*?)(?=<p>|<P>|<h3|<H3|$)', body, flags=re.S | re.I):
        raw = m.group(1)
        cont = 'contnote' in raw
        t = _clean(raw)
        if not t or re.fullmatch(r'p\. \d+', t):
            continue
        if cont and paras:
            paras[-1] += ' ' + t
        else:
            paras.append(t)
    verses = []
    speaker = None
    for t in paras:
        m = re.match(r'^(\d+)(?:\s*-\s*(\d+))?\.\s+(.*)$', t)
        if m:
            a = int(m.group(1)); b = int(m.group(2) or a)
            verses.append({'start': a, 'end': b, 'text': m.group(3).strip(), 'speaker': speaker})
            speaker = None
        elif re.match(r'^[A-Z][\wÀ-ſ ]+ said:$', t):
            speaker = t
        elif verses and not re.match(r'^(Thus|Here ends|Om|End of)', t) and len(t) > 40 and t[0].islower():
            verses[-1]['text'] += ' ' + t        # stray continuation
        elif verses:
            verses[-1].setdefault('trailing', []).append(t)
    notes = {}
    for m in re.finditer(r'<P><A NAME="fn_\d+"></A><A HREF="[^"]*">(\d+):(\d+)(?:-(\d+))?</A>(.*?)(?=<P><A NAME="fn_|<CENTER|$)',
                         foot, flags=re.S):
        v = int(m.group(2))
        body = m.group(4)
        parts = [_clean(p) for p in re.split(r'</?p>', body, flags=re.I)]
        parts = [p for p in parts if p and not re.fullmatch(r'p\. \d+', p)]
        notes.setdefault(v, []).extend(parts)
    return verses, notes


def load():
    return {c: parse_chapter(c) for c in range(1, 19)}


if __name__ == '__main__':
    d = load()
    for c, (vs, ns) in d.items():
        nums = []
        for v in vs:
            nums.extend(range(v['start'], v['end'] + 1))
        missing = sorted(set(range(1, max(nums) + 1)) - set(nums))
        print(c, 'entries', len(vs), 'max', max(nums), 'missing', missing, 'dups',
              [n for n in set(nums) if nums.count(n) > 1], 'notes', len(ns))
    print(d[2][0][46])
    print(d[2][1][47])
