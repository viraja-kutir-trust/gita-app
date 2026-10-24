"""Devanagari helpers: syllable (akshara) counting, normalisation for comparison,
pada splitting, transliteration and ASCII / phonetic folding.

Shared by build_verses.py, validate_verses.py and build_sqlite.py.
The ASCII / phonetic folding here MUST stay in sync with foldAscii()/foldPhonetic()
in src/gita-data/db.js (the query side).
"""
import re
import unicodedata

VIRAMA = "्"
NUKTA = "़"
ANUSVARA = "ं"
VISARGA = "ः"
CHANDRABINDU = "ँ"
AVAGRAHA = "ऽ"
DANDA = "।"
DDANDA = "॥"
ZW = "‌‍"


def is_consonant(ch):
    return "क" <= ch <= "ह" or "क़" <= ch <= "य़"


def is_indep_vowel(ch):
    return "ऄ" <= ch <= "औ" or ch in "ॠॡ"


def is_matra(ch):
    return "ा" <= ch <= "ौ" or ch in "ॢॣ"


def is_mark(ch):
    """Characters that attach to the preceding syllable."""
    return is_matra(ch) or ch in (ANUSVARA, VISARGA, CHANDRABINDU, NUKTA) or ch in ZW


def nuclei(s):
    """Return list of indices where a syllable nucleus is located (consonant
    carrying a vowel, or an independent vowel)."""
    out = []
    n = len(s)
    for i, ch in enumerate(s):
        if is_indep_vowel(ch) or ch == "\u0950":  # ॐ = one syllable
            out.append(i)
        elif is_consonant(ch):
            j = i + 1
            while j < n and s[j] in NUKTA + ZW:
                j += 1
            if j < n and s[j] == VIRAMA:
                continue
            out.append(i)
    return out


def count_syllables(s):
    return len(nuclei(s))


def split_at_syllable(s, k):
    """Split string s (one half-verse, words separated by spaces) after the
    k-th syllable. Returns (left, right, mid_word: bool).

    The boundary is placed right after the k-th nucleus and its marks
    (matra, anusvara, visarga).  If only virama-final consonants remain
    before the next space (e.g. 'सम्यक्'), they stay on the left and the split
    happens at the space."""
    nu = nuclei(s)
    if k <= 0 or k >= len(nu):
        raise ValueError("bad split %d of %d" % (k, len(nu)))
    p = nu[k - 1] + 1
    while p < len(s) and (is_mark(s[p]) or s[p] == NUKTA):
        p += 1
    # consume trailing virama-final consonants up to a space
    q = p
    while q < len(s) and (is_consonant(s[q]) or s[q] in VIRAMA + NUKTA + ZW):
        q += 1
    if q < len(s) and s[q] == " " and all(
        not is_consonant(s[t]) or (t + 1 < len(s) and s[t + 1] in VIRAMA + NUKTA)
        for t in range(p, q)
    ):
        p = q
    elif q == len(s):
        p = q
    left, right = s[:p], s[p:]
    mid = not (right.startswith(" ") or left.endswith(" ") or right == "")
    if s[p:p + 1] == AVAGRAHA:
        mid = True
    return left.strip(), right.strip(), mid


def word_boundary_splits(s):
    """For each space in s, (syllables_left, index)."""
    res = []
    for m in re.finditer(" ", s):
        res.append((count_syllables(s[: m.start()]), m.start()))
    return res


# --------------------------------------------------------------- comparison
INDEP_TO_MATRA = {
    "अ": "", "आ": "ा", "इ": "ि", "ई": "ी", "उ": "ु", "ऊ": "ू", "ऋ": "ृ", "ॠ": "ॄ",
    "ए": "े", "ऐ": "ै", "ओ": "ो", "औ": "ौ",
}


def norm_with_map(s, merge_vowels=True):
    """Normalise Devanagari for variant comparison.

    Returns (norm, units) where units[i] = (start, end) span in s of norm[i].
    Ignored: spaces, dandas, punctuation, digits, ZWJ/ZWNJ, avagraha.
    Class nasal + virama before a consonant (or verse-final म्) -> anusvara.
    Chandrabindu -> anusvara."""
    out, units = [], []
    n = len(s)
    i = 0
    while i < n:
        ch = s[i]
        if ch in " \n\t" + DANDA + DDANDA + "|:.-" + ZW + AVAGRAHA or ch.isdigit() or ("\u0966" <= ch <= "\u096f"):
            i += 1
            continue
        if ch in "ङञणनम" and i + 1 < n and s[i + 1] == VIRAMA:
            j = i + 2
            while j < n and s[j] in " " + ZW:
                j += 1
            if (j < n and is_consonant(s[j])) or (ch == "म" and (j >= n or s[j] in DANDA + DDANDA + "\n")):
                out.append(ANUSVARA)
                units.append((i, i + 2))
                i += 2
                continue
        # consonant + virama (+space) + independent vowel == consonant + matra
        if merge_vowels and is_consonant(ch) and i + 1 < n and s[i + 1] == VIRAMA:
            j = i + 2
            while j < n and s[j] in " " + ZW:
                j += 1
            if j < n and is_indep_vowel(s[j]) and s[j] in INDEP_TO_MATRA:
                m = INDEP_TO_MATRA[s[j]]
                out.append(ch)
                if m:
                    units.append((i, j))
                    out.append(m)
                    units.append((j, j + 1))
                else:
                    units.append((i, j + 1))
                i = j + 1
                continue
        if ch == CHANDRABINDU:
            out.append(ANUSVARA)
            units.append((i, i + 1))
            i += 1
            continue
        out.append(ch)
        units.append((i, i + 1))
        i += 1
    return "".join(out), units


def norm(s):
    return norm_with_map(s)[0]


# --------------------------------------------------------------- folding
_ASCII_MAP = {
    "ā": "a", "ī": "i", "ū": "u", "ṛ": "r", "ṝ": "r", "ḷ": "l", "ḹ": "l",
    "ṃ": "m", "ṁ": "m", "ḥ": "h", "ṅ": "n", "ñ": "n", "ṭ": "t", "ḍ": "d",
    "ṇ": "n", "ś": "s", "ṣ": "s", "ẖ": "h", "ḫ": "h", "'": "", "’": "",
}


def fold_ascii(s):
    """IAST (or any Latin) -> lowercase ASCII, diacritics stripped.
    Non-Latin characters are kept unchanged."""
    s = unicodedata.normalize("NFC", s.lower())
    s = "".join(_ASCII_MAP.get(c, c) for c in s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not ("\u0300" <= c <= "\u036f"))
    return unicodedata.normalize("NFC", s)


_PHON_RULES = [
    ("chh", "c"), ("ch", "c"), ("sh", "s"), ("x", "ks"),
    ("w", "v"), ("ee", "i"), ("oo", "u"), ("aa", "a"), ("ii", "i"), ("uu", "u"),
    ("ri", "r"),
    ("kh", "k"), ("gh", "g"), ("jh", "j"), ("th", "t"), ("dh", "d"),
    ("ph", "p"), ("bh", "b"), ("f", "p"), ("z", "j"), ("q", "k"),
]


def fold_phonetic(s):
    """Very loose phonetic key for ASCII-typed Sanskrit: 'krishna', 'krsna',
    'kRSNa' -> 'krsna'; 'karmanye', 'karmaNye' -> 'karmanye'.
    Applied to both content and query.  Operates on fold_ascii() output."""
    s = fold_ascii(s)
    s = re.sub(r"[^a-z0-9\s]", "", s)
    for a, b in _PHON_RULES:
        s = s.replace(a, b)
    s = re.sub(r"([a-z])\1+", r"\1", s)  # collapse doubles: 'sattva' -> 'satva'
    return s


# --------------------------------------------------------------- transliteration
_sanscript = None


def to_iast(deva):
    global _sanscript
    if _sanscript is None:
        from indic_transliteration import sanscript
        _sanscript = sanscript
    s = _sanscript.transliterate(deva, _sanscript.DEVANAGARI, _sanscript.IAST)
    s = s.replace("~", "ṃ")  # chandrabindu (श्रद्धावाँल्लभते) -> ṃ, as in most IAST editions
    # sanscript keeps dandas; we never pass them, but be safe
    return s.replace("।", "|").replace("॥", "||")


def iast_to_deva(iast):
    global _sanscript
    if _sanscript is None:
        from indic_transliteration import sanscript
        _sanscript = sanscript
    return _sanscript.transliterate(iast, _sanscript.IAST, _sanscript.DEVANAGARI)


LONG_MATRAS = set("ाीूॄेैोौॣ")
LONG_INDEP = set("आईऊॠएऐओऔॡ")


def weights(s):
    """Syllable weights for string s: list of 'L' (guru) / 'S' (laghu)."""
    nu = nuclei(s)
    res = []
    for k, i in enumerate(nu):
        j = i + 1
        heavy = False
        if s[i] == "\u0950":
            heavy = True
        elif is_indep_vowel(s[i]):
            heavy = s[i] in LONG_INDEP
        else:
            while j < len(s) and s[j] in NUKTA + ZW:
                j += 1
            if j < len(s) and is_matra(s[j]):
                heavy = s[j] in LONG_MATRAS
                j += 1
        if j < len(s) and s[j] in (ANUSVARA, VISARGA, CHANDRABINDU):
            heavy = True
            j += 1
        # consonants up to next nucleus
        nxt = nu[k + 1] if k + 1 < len(nu) else len(s)
        cons = sum(1 for t in range(j, nxt) if is_consonant(s[t]))
        if k + 1 < len(nu) and is_consonant(s[nxt]):
            cons += 1  # onset of next syllable
        if cons >= 2:
            heavy = True
        res.append("L" if heavy else "S")
    return res
