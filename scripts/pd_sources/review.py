"""Build scripts/out/pd_sources/review.html: page-image crops next to our cleaned output.

~25 random verses from each work plus the fixed checks 2.47, 18.66, 13.1, 11.36.  Crops are cut
from the scans on the fly (page images are extracted to a temp dir and deleted).
"""
import base64, html, json, os, random, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import OUT, CACHE, SW_ID, MS_ID
from common import db

FIXED = ['2.47', '18.66', '13.1', '11.36']
N_RANDOM = 25


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


class Pages:
    def __init__(self, pdf, mode):
        self.pdf, self.mode = pdf, mode
        self.td = tempfile.mkdtemp()
        self.cache = {}

    def image(self, page):
        if page in self.cache:
            return self.cache[page]
        base = os.path.join(self.td, 'p%04d' % page)
        if self.mode == 'images':
            subprocess.run(['pdfimages', '-f', str(page), '-l', str(page), '-png', self.pdf, base], check=True)
            ims = sorted(f for f in os.listdir(self.td) if f.startswith('p%04d' % page))
            path = os.path.join(self.td, ims[0])
        else:
            subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-r', '300', '-gray', '-png', self.pdf, base], check=True)
            ims = sorted(f for f in os.listdir(self.td) if f.startswith('p%04d' % page))
            path = os.path.join(self.td, ims[0])
        self.cache[page] = path
        return path

    def crop(self, page, box, scale=0.45):
        src = self.image(page)
        x0, y0, x1, y1 = [int(v) for v in box]
        x0, y0 = max(0, x0 - 20), max(0, y0 - 15)
        w, h = x1 - x0 + 40, y1 - y0 + 30
        out = os.path.join(self.td, 'crop.jpg')
        subprocess.run(['magick', src, '-crop', '%dx%d+%d+%d' % (w, h, x0, y0), '+repage', '-resize', '%d%%' % int(scale * 100),
                        '-quality', '70', out], check=True)
        b = open(out, 'rb').read()
        return 'data:image/jpeg;base64,' + base64.b64encode(b).decode()

    def close(self):
        subprocess.run(['rm', '-rf', self.td])


def union_by_page(items):
    """[[page, bbox], ...] -> {page: bbox}"""
    out = {}
    for p, b in items:
        if p in out:
            o = out[p]
            out[p] = [min(o[0], b[0]), min(o[1], b[1]), max(o[2], b[2]), max(o[3], b[3])]
        else:
            out[p] = list(b)
    return out


def esc(s):
    return html.escape(s or '')


def main():
    sw_w = load(os.path.join(OUT, 'swarupananda_wbw.json'))['verses']
    sw_t = load(os.path.join(OUT, 'swarupananda_translation.json'))
    ms = load(os.path.join(OUT, 'mahadevasastri.json'))
    for name, dst in (('swarupananda_wbw_low.json', sw_w), ('swarupananda_translation_low.json', sw_t), ('mahadevasastri_low.json', ms)):
        p = os.path.join(OUT, name)
        if os.path.exists(p):
            x = load(p)
            dst.update(x['verses'] if 'verses' in x else x)
    swd = load(os.path.join(CACHE, 'sw_debug.json'))
    msd = load(os.path.join(CACHE, 'ms_debug.json'))
    sw_unit = {}
    for d in swd:
        for v in d['verses']:
            sw_unit.setdefault(v, d)
    ms_unit = {}
    for d in msd:
        for v in d['keys']:
            ms_unit.setdefault(v, d)
    con = db()
    text = {'%d.%d' % (r[0], r[1]): json.loads(r[2]) for r in con.execute('select chapter, verse, lines_json from verses')}
    rnd = random.Random(2026)
    sw_keys = sorted(set(sw_w) | set(sw_t), key=lambda k: tuple(map(int, k.split('.'))))
    ms_keys = sorted(ms, key=lambda k: tuple(map(int, k.split('.'))))
    sw_pick = FIXED + [k for k in rnd.sample(sw_keys, N_RANDOM) if k not in FIXED]
    ms_pick = FIXED + [k for k in rnd.sample(ms_keys, N_RANDOM) if k not in FIXED]
    swp = Pages(os.path.join(CACHE, 'sw.pdf'), 'images')
    msp = Pages(os.path.join(CACHE, 'ms.pdf'), 'render')
    cards = []

    def order(k):
        return tuple(map(int, k.split('.')))

    for k in sorted(sw_pick, key=order):
        d = sw_unit.get(k)
        crops = []
        if d and d.get('lines'):
            allb = d['lines']['wbw_lines'] + d['lines']['trans_lines'] + d['lines']['note_lines']
            for p, b in sorted(union_by_page(allb).items()):
                crops.append((p, swp.crop(p, b)))
        w = sw_w.get(k)
        t = sw_t.get(k)
        body = ''
        if w:
            rows = ''.join('<tr><td class="dev">%s</td><td class="iast">%s</td><td>%s</td><td class="m m-%s">%s</td></tr>' % (
                esc(x['term_dev'] or '?'), esc(x['term_iast'] or ''), esc(x['meaning']), esc(x['match']), esc(x['match']))
                for x in w['words'])
            body += '<h4>Word-for-word <span class="conf c-%s">%s</span> <span class="small">matched %d · guessed %d · unresolved %d · DB words not glossed %d</span></h4><table>%s</table>' % (
                w['confidence'], w['confidence'], w['matched'], w['guessed'], w['unresolved'], w['uncovered_db_words'], rows)
        else:
            body += '<h4>Word-for-word</h4><p class="miss">not in output</p>'
        if t:
            body += '<h4>Translation <span class="conf c-%s">%s</span>%s</h4><p>%s</p>' % (
                t['confidence'], t['confidence'], (' <span class="small">book §%s</span>' % esc(t.get('book_verse'))), esc(t['text']))
            if t.get('notes'):
                body += '<h4>Notes <span class="conf c-%s">%s</span></h4><p class="notes">%s</p>' % (t['notes_confidence'], t['notes_confidence'], esc(t['notes']))
        else:
            reason = (d or {}).get('status') or ('the 1909 book has no separate verse here (Arjuna\'s question 13.1 is not in this edition)' if k == '13.1' else 'not found')
            body += '<h4>Translation</h4><p class="miss">%s</p>' % esc(reason)
        cards.append(('Swarupananda (1909)', k, crops, body))
    for k in sorted(ms_pick, key=order):
        d = ms_unit.get(k)
        crops = []
        if d:
            allb = d['verse_bbox'] + d['comm_bbox']
            for p, b in sorted(union_by_page(allb).items()):
                pdfp = d.get('pdf_map', {}).get(str(p))
                if pdfp:
                    pg, sx, sy = pdfp
                    crops.append((pg, msp.crop(pg, [b[0] * sx, b[1] * sy, b[2] * sx, b[3] * sy], 0.42)))
        r = ms.get(k)
        if r:
            body = '<h4>Translation <span class="conf c-%s">%s</span>%s</h4><p>%s</p>' % (
                r['confidence'], r['confidence'], (' <span class="small">range %s</span>' % esc(r['range'])) if r.get('range') else '', esc(r['translation']))
            if r.get('introduction'):
                body += '<h4>Introduction (before the verse)</h4>' + ''.join('<p class="notes">%s</p>' % esc(x) for x in r['introduction'])
            body += '<h4>Commentary (%d paragraphs; first 3 shown)</h4>' % len(r['commentary']) + \
                ''.join('<p class="notes">%s</p>' % esc(x) for x in r['commentary'][:3])
        else:
            body = '<p class="miss">%s</p>' % ('not in this book (Shankara does not comment on Arjuna\'s question; Sastri omits it)' if k == '13.1' else 'not found in OCR')
        cards.append(('Mahadeva Sastri (1901)', k, crops, body))
    swp.close()
    msp.close()
    parts = []
    for work, k, crops, body in cards:
        skt = '<br>'.join(esc(x) for x in text.get(k, []))
        imgs = ''.join('<figure><img src="%s" alt="scan page %d"><figcaption>PDF page %d</figcaption></figure>' % (src, p, p) for p, src in crops) or '<p class="miss">no scan region</p>'
        parts.append('<section class="card"><header><span class="work">%s</span><span class="key">%s</span><span class="skt">%s</span></header><div class="cols"><div class="scan">%s</div><div class="out">%s</div></div></section>' % (
            esc(work), esc(k), skt, imgs, body))
    page = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PD Sources Review</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1b18;--muted:#6b665e;--card:#fff;--line:#e4e0d8;--hi:#2f6b3a;--med:#9a6a00;--lo:#a33;--accent:#4a5ea8}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#171614;--fg:#ece8e1;--muted:#a29c92;--card:#211f1c;--line:#38342e;--hi:#7fc28b;--med:#e0b04a;--lo:#f08080;--accent:#9fb0f0}}
:root[data-theme="dark"]{--bg:#171614;--fg:#ece8e1;--muted:#a29c92;--card:#211f1c;--line:#38342e;--hi:#7fc28b;--med:#e0b04a;--lo:#f08080;--accent:#9fb0f0}
body{background:var(--bg);color:var(--fg);font:15px/1.5 Georgia,serif;margin:0;padding:16px}
h1{font-size:22px;margin:0 0 4px} .lead{color:var(--muted);max-width:900px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;margin:18px 0;padding:12px 14px}
.card header{display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:8px}
.work{font-weight:bold;color:var(--accent)} .key{font-size:20px;font-weight:bold} .skt{color:var(--muted);font-size:14px}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
@media (max-width:800px){.cols{grid-template-columns:1fr}}
.scan img{max-width:100%;border:1px solid var(--line);background:#fff} figure{margin:0 0 8px} figcaption{font-size:12px;color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:14px} td{border-bottom:1px solid var(--line);padding:2px 6px;vertical-align:top}
.dev{font-size:16px;white-space:nowrap} .iast{font-style:italic;color:var(--muted)} .m{font-size:11px;color:var(--muted)}
.m-unresolved,.m-gloss,.m-elimination{color:var(--med)} .m-unresolved{color:var(--lo)}
h4{margin:10px 0 4px;font-size:14px} .small{font-weight:normal;color:var(--muted);font-size:12px}
.conf{font-size:11px;padding:1px 6px;border-radius:9px;border:1px solid currentColor;font-family:sans-serif}
.c-high{color:var(--hi)} .c-medium{color:var(--med)} .c-low{color:var(--lo)} .notes{font-size:14px} .miss{color:var(--lo)}
</style></head><body>
<h1>Public-domain sources: scan vs. cleaned output</h1>
<p class="lead">Swami Swarupananda, <i>Srimad-Bhagavad-Gita</i>, 1st ed. 1909 (archive.org @SW@) and A. Mahadeva Sastri, <i>The Bhagavad-Gita with the commentary of Sri Sankaracharya</i>, 2nd ed. 1901 (archive.org @MS@). Left: crop of the scan region the text was taken from. Right: our output. Verses: 2.47, 18.66, 13.1, 11.36 plus @N@ random per work (seed 2026). Match codes in the word table: <b>dev</b> = headword matched by Devanagari OCR, <b>gloss</b> = matched by gloss/transliteration similarity, <b>elimination</b> = last remaining word, <b>supplied</b> = word supplied in parentheses by the translator, <b>unresolved</b> = gloss kept but headword unknown. Records marked <i>low</i> are not in the main JSON files but in the <code>*_low.json</code> files.</p>
@BODY@
</body></html>'''
    page = page.replace('@SW@', SW_ID).replace('@MS@', MS_ID).replace('@N@', str(N_RANDOM)).replace('@BODY@', '\n'.join(parts))
    with open(os.path.join(OUT, 'review.html'), 'w', encoding='utf-8') as f:
        f.write(page)
    print('review.html', len(page) // 1024, 'KB', len(cards), 'cards')


if __name__ == '__main__':
    main()
