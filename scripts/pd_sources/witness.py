"""Second witnesses for the English of the word-for-word glosses.

The 1967 "Tenth Impression" of Swarupananda's Gita (Advaita Ashrama) reprints the 1909 text; two
archive.org scans of it have usable English OCR (Devanagari is garbage there).  We only use them to
correct OCR misreadings of individual English gloss words in the 1909 scan: a 1909 token that is
not an English word is replaced by the aligned witness token when the two are within a small edit
distance.  Nothing is ever added from the witness.

Also restores the book's circumflexed proper names (Brâhmana, Pândava ...) in glosses, using the
spellings of the sacred-texts transcription of the same book.
"""
import difflib, os, re, sys
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import CACHE
from textfix import ntok, lev, strip_acc
import sacred

WITNESS_FILES = ['swrkm.txt', 'swBGT.txt']
WITNESS_IDS = {'swrkm.txt': 'bhagavad-gita-swarupananda-rkm (1967 Tenth Impression, Advaita Ashrama)',
               'swBGT.txt': 'BhagavadGitaTranslatedBySwamiSwarupananda (Advaita Ashrama reprint)'}


def _toks_pos(text):
    return [(m.group(0), m.start()) for m in re.finditer(r"\S+", text)]


class Witness:
    def __init__(self, vocab):
        self.vocab = vocab
        self.texts = {}
        for f in WITNESS_FILES:
            p = os.path.join(CACHE, f)
            if os.path.exists(p):
                self.texts[f] = open(p, encoding='utf-8', errors='replace').read()
        self._index()
        self._accents()

    def _index(self):
        """Locate every numbered translation paragraph in each witness."""
        ents = []
        for c, (vs, notes) in sacred.load().items():
            for v in vs:
                ents.append((c, v['start'], v['end'], v['text']))
        self.anchors = {}
        for f, t in self.texts.items():
            pos = 0
            res = {}
            heads = [(m.start(), int(m.group(1)), m.end()) for m in re.finditer(r'(?m)^\s*(\d{1,2})(?:\s*-\s*\d{1,2})?[.,]\s', t)]
            hi = 0
            for (c, a, b, txt) in ents:
                S = [ntok(w) for w in txt.split()[:12]]
                best = (0.0, None)
                for k in range(hi, min(len(heads), hi + 60)):
                    st, num, en = heads[k]
                    if num != a:
                        continue
                    W = [ntok(w) for w in t[en:en + 200].split()[:12]]
                    r = difflib.SequenceMatcher(None, W, S, autojunk=False).ratio()
                    if r > best[0]:
                        best = (r, k)
                if best[1] is not None and best[0] >= 0.5:
                    res[(c, a)] = heads[best[1]][0]
                    hi = best[1] + 1
            self.anchors[f] = res

    def _accents(self):
        acc = defaultdict(Counter)
        plain = Counter()
        for c, (vs, notes) in sacred.load().items():
            blob = ' '.join(v['text'] for v in vs) + ' ' + ' '.join(' '.join(n) for n in notes.values())
            for w in re.findall(r"[A-Za-zÀ-ſ]+", blob):
                if w != strip_acc(w):
                    acc[strip_acc(w).lower()][w] += 1
                else:
                    plain[w.lower()] += 1
        self.accent_map = {k: v.most_common(1)[0][0] for k, v in acc.items() if len(v) == 1 and plain[k] == 0}

    def wset(self, gl):
        s = set()
        for toks in gl or []:
            for w in toks:
                for part in re.split(r'[-\u2014]', w):
                    n = ntok(part)
                    if n:
                        s.add(n)
                if ntok(w):
                    s.add(ntok(w))
        return s if s else None

    def glosses(self, entry):
        """English-ish tokens of the witness word-for-word block for this book unit."""
        out = []
        for f, t in self.texts.items():
            a = self.anchors[f].get((entry['ch'], entry['start']))
            if a is None:
                continue
            seg = t[max(0, a - 1600):a]
            k = seg.rfind(']')
            if k >= 0:
                seg = seg[k + 1:]
            # drop the running-head lines like "45-47) WAY OF KNOWLEDGE 57"
            seg = re.sub(r'(?m)^.*(WAY|GRIEF|VISION|GLIMPSES|DISCRIMINATION|CLASSIFICATION|ENQUIRY|GITA|CHAPTER).*$', ' ', seg)
            toks = []
            for w in seg.split():
                core = re.sub(r"^[^A-Za-z]+|[^A-Za-z]+$", '', w)
                if not core or not ntok(core) in self.vocab:
                    continue
                if len(core) >= 2 and core.isupper():
                    continue            # Devanagari mis-read as capitals ("AT", "HIRHT")
                if re.search(r'[^A-Za-z\-\'()\[\],.;:!?"]', w):
                    continue
                toks.append(w)
            out.append(toks)
        return out


def fix_glosses(items, wit, vocab):
    """Correct non-word tokens in glosses using the witnesses; flag remaining non-words."""
    stats = {'tokens': 0, 'fixed': 0, 'nonword_left': 0}
    # flatten
    flat = []
    for ii, it in enumerate(items):
        for ti, w in enumerate(it['gloss'].split()):
            flat.append((ii, ti, w))
    G = [ntok(w) for _, _, w in flat]
    toks_per_item = [it['gloss'].split() for it in items]
    for wt in (wit or []):
        W = [ntok(w) for w in wt]
        sm = difflib.SequenceMatcher(None, G, W, autojunk=False)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op != 'replace':
                continue
            for k in range(min(i2 - i1, j2 - j1)):
                gi = i1 + k
                ii, ti, w = flat[gi]
                g, cand = G[gi], W[j1 + k]
                if not g or g in vocab:
                    continue
                if lev(g, cand) <= max(1, len(cand) // 3):
                    orig = toks_per_item[ii][ti]
                    new = re.sub(r"[A-Za-zÀ-ſ']+", cand if not orig[:1].isupper() else cand[:1].upper() + cand[1:], orig, count=1)
                    toks_per_item[ii][ti] = new
                    G[gi] = cand
                    items[ii].setdefault('fixed', []).append((orig, new))
                    stats['fixed'] += 1
    for ii, it in enumerate(items):
        ws = toks_per_item[ii]
        bad = 0
        for wi, w in enumerate(ws):
            n = ntok(w)
            if n and n not in vocab and not re.fullmatch(r'\d+', n):
                bad += 1
        stats['tokens'] += len(ws)
        stats['nonword_left'] += bad
        it['gloss'] = ' '.join(ws)
        it['gloss_bad'] = bad
    return items, stats


def restore_accents(text, accent_map):
    def rep(m):
        w = m.group(0)
        k = w.lower()
        if k in accent_map and w[:1].isupper():
            a = accent_map[k]
            return a[:1].upper() + a[1:]
        return w
    return re.sub(r"[A-Za-z]+", rep, text)


def fix_tokens(words, wit, vocab):
    """Pre-labelling correction of mis-read English gloss tokens against the witness block."""
    if not wit:
        return words
    idx = [i for i, w in enumerate(words) if not re.search(r'[ऀ-ॿ]', w['t'])]
    G = [ntok(words[i]['t']) for i in idx]
    out = [dict(w) for w in words]
    for wt in wit:
        W = [ntok(w) for w in wt]
        sm = difflib.SequenceMatcher(None, G, W, autojunk=False)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op != 'replace':
                continue
            for k in range(min(i2 - i1, j2 - j1)):
                g, cand = G[i1 + k], W[j1 + k]
                if not g or g in vocab or not cand:
                    continue
                if g == 'o' + cand and out[idx[i1 + k]]['t'][:1] == 'O':      # "Oson" = "O son"
                    w = out[idx[i1 + k]]
                    w['fixed'] = w['t']
                    w['t'] = 'O ' + w['t'][1:]
                    G[i1 + k] = cand
                    continue
                if len(cand) >= 2 and lev(g, cand) <= max(1, len(cand) // 3):
                    w = out[idx[i1 + k]]
                    orig = w['t']
                    wsurf = re.sub(r"^[^A-Za-z]+|[^A-Za-z]+$", '', wt[j1 + k])
                    if orig[:1].isupper() and wsurf[:1].islower():
                        wsurf = wsurf[:1].upper() + wsurf[1:]
                    m = re.match(r"^([^A-Za-zÀ-ſ]*)(.*?)([^A-Za-zÀ-ſ]*)$", orig)
                    w['t'] = m.group(1) + wsurf + m.group(3)
                    w['fixed'] = orig
                    G[i1 + k] = cand
    return out


def merge_hyphens(lines_words, vocab, wset=None):
    """Join a token ending in '-' at a line end with the first token of the next line when the
    joined word is known (else keep the hyphen: compounds like 'middle-state')."""
    out = []
    for li, ws in enumerate(lines_words):
        ws = [dict(w) for w in ws]
        if out and ws and out[-1]['t'].endswith('-') and not re.search(r'[ऀ-ॿ]', out[-1]['t']) \
                and not re.search(r'[ऀ-ॿ]', ws[0]['t']):
            a = out[-1]['t'][:-1]
            b = ws[0]['t']
            j = ntok(a + b)
            jb = ntok(b)
            if j in vocab or (wset and j in wset) or (jb and jb not in vocab):
                out[-1] = dict(out[-1], t=a + b, alt=None)
            else:
                out[-1] = dict(out[-1], t=a + '-' + b, alt=None)
            ws = ws[1:]
        out.extend(ws)
    return out
