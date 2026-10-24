"""OCR text clean-up helpers: line joining / de-hyphenation and reference-guided token correction.

The correction is deliberately conservative: a token from the reference transcription replaces the
OCR token only when the two are evidently the same word mis-read (normalised equality, or small edit
distance with the OCR token not being a real word).  When the OCR clearly shows a *different* real
word (an edition variant) the OCR reading is kept and reported.
"""
import difflib, re, unicodedata


def strip_acc(s):
    s = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in s if not unicodedata.combining(c))


def ntok(w):
    return re.sub(r'[^a-z0-9]', '', strip_acc(w).lower())


def lev(a, b):
    if a == b:
        return 0
    if abs(len(a) - len(b)) > 3:
        return 99
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


QUOTES = {'‘': "'", '’': "'", '“': '"', '”': '"', '`': "'", '„': '"'}


def tidy(s):
    for a, b in QUOTES.items():
        s = s.replace(a, b)
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'\s+([,;:.!?)\]])', r'\1', s)
    s = re.sub(r'([(\[])\s+', r'\1', s)
    s = re.sub(r'\s*—\s*', '—', s)
    s = re.sub(r'\s*--\s*', '—', s)
    return s


def join_lines(lines, vocab=None, ref_vocab=None):
    """Join OCR lines, removing end-of-line hyphenation when the joined word is known."""
    out = ''
    for l in lines:
        l = l.strip()
        if not l:
            continue
        if out.endswith('-') and not out.endswith('--'):
            m1 = re.search(r'([A-Za-zÀ-ſ]+)-$', out)
            m2 = re.match(r'([A-Za-zÀ-ſ]+)', l)
            if m1 and m2:
                joined = (m1.group(1) + m2.group(1))
                hyph = m1.group(1) + '-' + m2.group(1)
                jn = ntok(joined)
                keep_h = False
                if ref_vocab is not None and ntok(hyph) in ref_vocab.get('hyph', set()):
                    keep_h = True
                elif ref_vocab is not None and jn in ref_vocab.get('words', set()):
                    keep_h = False
                elif vocab is not None and jn in vocab:
                    keep_h = False
                elif m2.group(1)[0].isupper():
                    keep_h = True
                out = out[:-1] + ('-' if keep_h else '') + l
                continue
        out = (out + ' ' + l) if out else l
    return out


def ref_vocab_of(texts):
    words, hyph = set(), set()
    for t in texts:
        for w in re.findall(r"[A-Za-zÀ-ſ']+(?:-[A-Za-zÀ-ſ']+)*", t):
            if '-' in w:
                hyph.add(ntok(w.replace('-', '-')))
                for p in w.split('-'):
                    words.add(ntok(p))
                words.add(ntok(w))
            else:
                words.add(ntok(w))
    # hyph stores the normalised form with hyphens removed but we need to know it was hyphenated
    hyph = set(ntok(w) for t in texts for w in re.findall(r"[A-Za-zÀ-ſ]+-[A-Za-zÀ-ſ]+", t))
    return {'words': words, 'hyph': hyph}


def is_word(w, vocab):
    n = ntok(w)
    return bool(n) and (n in vocab)


JUNK = re.compile(r'^[^A-Za-z0-9À-ſ"\'()]+$')


def correct(ocr_text, ref_text, vocab):
    """Return (text, stats).  ocr_text and ref_text are single strings."""
    A = ocr_text.split()
    B = ref_text.split()
    na = [ntok(w) for w in A]
    nb = [ntok(w) for w in B]
    sm = difflib.SequenceMatcher(None, na, nb, autojunk=False)
    # trim OCR debris before the first / after the last solid match (anchor ranges are loose)
    blocks = [b for b in sm.get_matching_blocks() if b.size >= 2]
    if blocks:
        f, l = blocks[0], blocks[-1]
        a0 = max(0, f.a - f.b - 1)                 # allow as many OCR tokens as reference tokens are unmatched (+1)
        a1 = min(len(A), l.a + l.size + (len(B) - l.b - l.size) + 1)
        if a0 > 0 or a1 < len(A):
            A = A[a0:a1]
            na = na[a0:a1]
            sm = difflib.SequenceMatcher(None, na, nb, autojunk=False)
    out = []
    st = {'equal': 0, 'fixed': 0, 'variant': 0, 'dropped': 0, 'inserted': 0, 'variants': []}
    ops = sm.get_opcodes()
    clean = all(op == 'equal' or (op == 'delete' and all(JUNK.match(w) for w in A[i1:i2])) for op, i1, i2, j1, j2 in ops)
    first_eq = next((k for k, o in enumerate(ops) if o[0] == 'equal'), None)
    last_eq = max((k for k, o in enumerate(ops) if o[0] == 'equal'), default=None)
    for oi, (op, i1, i2, j1, j2) in enumerate(ops):
        if op == 'delete' and first_eq is not None and (oi < first_eq or oi > last_eq) and \
                sum(1 for w in A[i1:i2] if not is_word(w, vocab)) * 2 >= (i2 - i1):
            st['dropped'] += i2 - i1          # debris outside the anchored passage
            continue
        if op == 'equal':
            for k in range(i2 - i1):
                a, b = A[i1 + k], B[j1 + k]
                if clean:
                    out.append(b)                  # whole passage agrees: take proofread surface
                else:
                    # keep the scan's punctuation/case; borrow only the reference's accents
                    ma = re.match(r"^(\W*)(.*?)(\W*)$", a)
                    mb = re.match(r"^(\W*)(.*?)(\W*)$", b)
                    core = mb.group(2) if strip_acc(mb.group(2)).lower() == strip_acc(ma.group(2)).lower() and \
                        mb.group(2)[:1].lower() == ma.group(2)[:1].lower() and ma.group(2)[:1] == ma.group(2)[:1] else ma.group(2)
                    if core and ma.group(2)[:1].isupper() != core[:1].isupper():
                        core = (core[:1].upper() if ma.group(2)[:1].isupper() else core[:1].lower()) + core[1:]
                    out.append(ma.group(1) + core + ma.group(3))
            st['equal'] += i2 - i1
        elif op == 'replace':
            sa, sb = ''.join(na[i1:i2]), ''.join(nb[j1:j2])
            ok_all = all(is_word(w, vocab) for w in A[i1:i2] if ntok(w))
            r = difflib.SequenceMatcher(None, sa, sb).ratio()
            if max(i2 - i1, j2 - j1) <= 3 and all(not is_word(x, vocab) for x in A[i1:i2]) and \
                    abs((i2 - i1) - (j2 - j1)) <= 1:
                out.extend(B[j1:j2])              # the scan shows only OCR debris here
                st['fixed'] += max(i2 - i1, j2 - j1)
            elif i2 - i1 == j2 - j1 and all((not is_word(A[i1 + k], vocab)) and lev(na[i1 + k], nb[j1 + k]) <= max(1, len(nb[j1 + k]) // 2)
                                          for k in range(i2 - i1)):
                out.extend(B[j1:j2])
                st['fixed'] += i2 - i1
            elif sa == sb or (i2 - i1 == j2 - j1 and all(
                    lev(na[i1 + k], nb[j1 + k]) <= max(1, len(nb[j1 + k]) // 4) or not is_word(A[i1 + k], vocab)
                    for k in range(i2 - i1)) and r >= 0.6) or (not ok_all and r >= 0.75) or \
                    (r >= 0.85 and abs(len(sa) - len(sb)) <= 2):
                out.extend(B[j1:j2])
                st['fixed'] += max(i2 - i1, j2 - j1)
            else:
                out.extend(A[i1:i2])
                st['variant'] += max(i2 - i1, j2 - j1)
                st['variants'].append((' '.join(A[i1:i2]), ' '.join(B[j1:j2])))
        elif op == 'delete':
            seg = A[i1:i2]
            if all(JUNK.match(w) or re.search(r'[\u0900-\u097F]', w) or (w.isupper() and len(w) > 1) or re.fullmatch(r'\W*[\d\W]+\W*', w)
                   or (len(ntok(w)) <= 3 and not is_word(w, vocab)) for w in seg):
                st['dropped'] += len(seg)
            else:
                out.extend(seg)
                st['variant'] += len(seg)
                st['variants'].append((' '.join(seg), ''))
        elif op == 'insert':
            seg = B[j1:j2]          # never insert reference words the scan does not show
            st['variant'] += len(seg)
            st['variants'].append(('', ' '.join(seg)))
    return tidy(' '.join(out)), st
