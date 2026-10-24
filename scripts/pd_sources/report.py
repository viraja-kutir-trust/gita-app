"""Write scripts/out/pd_sources/REPORT.md from the outputs and the per-unit diagnostics."""
import json, os, sys
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import OUT, CACHE, SW_ID, MS_ID
from common import verse_counts

COUNTS = verse_counts()


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def table(rows, head):
    out = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)]
    for r in rows:
        out.append('| ' + ' | '.join(str(x) for x in r) + ' |')
    return '\n'.join(out)


def conf_by_ch(d, field='confidence'):
    by = defaultdict(Counter)
    for k, v in d.items():
        by[int(k.split('.')[0])][v[field]] += 1
    return by


def main():
    sw_w = load(os.path.join(OUT, 'swarupananda_wbw.json'))['verses']
    sw_t = load(os.path.join(OUT, 'swarupananda_translation.json'))
    ms = load(os.path.join(OUT, 'mahadevasastri.json'))
    n_main = (len(sw_w), len(sw_t), len(ms))
    for name, dst in (('swarupananda_wbw_low.json', sw_w), ('swarupananda_translation_low.json', sw_t), ('mahadevasastri_low.json', ms)):
        p = os.path.join(OUT, name)
        if os.path.exists(p):
            x = load(p)
            dst.update(x.get('verses', x) if name.endswith('wbw_low.json') else x)
    swd = load(os.path.join(CACHE, 'sw_debug.json'))
    msd = load(os.path.join(CACHE, 'ms_debug.json'))
    allkeys = ['%d.%d' % (c, v) for c in range(1, 19) for v in range(1, COUNTS[c] + 1)]

    wb, tb, nb, mb = conf_by_ch(sw_w), conf_by_ch(sw_t), defaultdict(Counter), conf_by_ch(ms)
    for k, v in sw_t.items():
        if v.get('notes'):
            nb[int(k.split('.')[0])][v['notes_confidence']] += 1
    rows = []
    tot = [0] * 13
    for c in range(1, 19):
        r = [c, COUNTS[c]]
        for by in (wb, tb, mb):
            r += [sum(by[c].values()), by[c]['high'], by[c]['medium'], by[c]['low']]
        rows.append(r)
        for i, x in enumerate(r[1:]):
            tot[i] += x
    rows.append(['**all**'] + tot[:13])
    cov = table(rows, ['ch', 'verses', 'S-wbw', 'hi', 'med', 'lo', 'S-transl', 'hi', 'med', 'lo', 'MS', 'hi', 'med', 'lo'])

    sw_missing_t = [k for k in allkeys if k not in sw_t]
    sw_missing_w = [k for k in allkeys if k not in sw_w]
    ms_missing = [k for k in allkeys if k not in ms]
    status = Counter(d.get('status', 'ok') for d in swd)
    incomplete = []
    for d in swd:
        if d.get('status'):
            incomplete.append('%s (book §%s): %s' % (', '.join(d['verses']), d['book'], d['status']))
    wsum = Counter()
    for v in sw_w.values():
        wsum['items'] += len(v['words'])
        for x in v['words']:
            wsum[x['match']] += 1
    ms_tc = Counter(v['translation_confidence'] for v in ms.values())
    ms_cc = Counter(v['commentary_confidence'] for v in ms.values())
    ms_unread = sorted((k for k, v in ms.items() if v.get('translation_unreadable_words')), key=lambda k: tuple(map(int, k.split('.'))))
    sw_var = sorted((k for k, v in sw_t.items() if v['confidence'] != 'high'), key=lambda k: tuple(map(int, k.split('.'))))
    nconf = Counter(v['notes_confidence'] for v in sw_t.values() if v.get('notes_confidence'))
    n_notes = sum(1 for v in sw_t.values() if v.get('notes'))
    ms_groups = sorted(set(v['range'] for v in ms.values() if v.get('range')))
    sw_groups = sorted(set(v['range'] for v in sw_t.values() if v.get('range')))
    n_intro = sum(1 for v in ms.values() if v.get('introduction'))

    def fmt(lst, n=400):
        return ', '.join(lst[:n]) + (' …' if len(lst) > n else '') if lst else '—'

    md = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'report_template.txt'), encoding='utf-8').read()
    import sw_regions
    low = lambda name: load(os.path.join(OUT, name)) if os.path.exists(os.path.join(OUT, name)) else {}
    sw_w_low = low('swarupananda_wbw_low.json').get('verses', {})
    sw_t_low = low('swarupananda_translation_low.json')
    ms_low = low('mahadevasastri_low.json')
    md = md.format(
        coverage=cov,

        sw_w_conf=dict(Counter(v['confidence'] for v in sw_w.values())),
        sw_t_conf=dict(Counter(v['confidence'] for v in sw_t.values())),
        ms_conf=dict(Counter(v['confidence'] for v in ms.values())), ms_tc=dict(ms_tc), ms_cc=dict(ms_cc),
        wsum=dict(wsum), n_notes=n_notes, nconf=dict(nconf),
        sw_missing_t=fmt(sw_missing_t), sw_missing_w=fmt(sw_missing_w), ms_missing=fmt(ms_missing),
        incomplete='\n'.join('- ' + x for x in incomplete) or '- none',
        ms_unread=fmt(ms_unread), sw_var=fmt(sw_var), ms_groups=fmt(ms_groups), sw_groups=fmt(sw_groups),
        n_intro=n_intro, SW_ID=SW_ID, MS_ID=MS_ID, status=dict(status),
        sw_w_main=n_main[0], sw_t_main=n_main[1], ms_main=n_main[2],
        sw_w_low=len(sw_w) - n_main[0], sw_t_low=len(sw_t) - n_main[1], ms_low=len(ms) - n_main[2],
        missing_pages=', '.join('%d (%d missing)' % (k, v) for k, v in sorted(sw_regions.MISSING_AFTER.items())),
    )
    with open(os.path.join(OUT, 'REPORT.md'), 'w', encoding='utf-8') as f:
        f.write(md)
    print('REPORT.md written')


if __name__ == '__main__':
    main()
