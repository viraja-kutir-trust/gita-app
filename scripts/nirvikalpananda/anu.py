"""Decode text typed in the Anu Telugu fonts (Priyaanka, Gowthami, Pragathi, Kranthi,
Pallavi) of the Nirvikalpananda PDFs into Unicode Telugu.

The PDFs' text layer gives one code point per glyph (MacRoman-like). A written
syllable is typed as   [prefix…] base [mark…]   (see anu_glyphs.py); `decode_cluster`
composes the Unicode syllable from the roles of its glyphs, and OVERRIDES holds the
few glyph sequences whose reading is not compositional. Every rule here was checked
against (a) the archive.org OCR of the same pages (majority vote per glyph cluster,
learn_map.py / check_map.py) and (b) the Sanskrit verse text already in gita.db.
"""
import re

from anu_glyphs import BASE, PREFIX, PUNCT, repair

VIRAMA = "్"

# base glyph -> (consonant or independent vowel, inherent vowel sign)
BASES = {
    "H": ("క", ""), "Q": ("గ", ""), "K": ("చ", ""), "[": ("జ", ""), "*": ("జ", ""),
    "_": ("డ", ""), "}": ("ణ", ""), "`": ("త", ""), "^": ("ద", ""), "#": ("న", ""),
    "<": ("న", ""), "Ñ": ("ప", ""), "á": ("ప", ""), "|": ("బ", ""), "É": ("బ", ""),
    "=": ("వ", ""), '"': ("వ", ""), "Ü": ("య", ""), "~": ("ర", ""), "Å": ("ల", ""),
    "Ö": ("ల", ""), "ã": ("స", ""), "™": ("స", ""), "â": ("శ", ""), "+": ("ష", ""),
    "ë": ("ష", ""), "Ç": ("హ", ""), "Y": ("ఖ", ""), "M": ("ఖ", ""), ">": ("ట", ""),
    "\\": ("ట", ""), "@": ("ట", ""), "V": ("ఙ", ""), "é": ("ఱ", ""), "à": ("ళ", ""),
    "‰": ("క", ""), "&": ("ఞ", ""),
    # consonant + vowel ligatures
    "x": ("న", "ి"), "q": ("వ", "ి"), "k": ("ద", "ి"), "z": ("చ", "ి"), "u": ("త", "ి"),
    "e": ("ల", "ి"), "i": ("ర", "ి"), "h": ("న", "ీ"), "g": ("వ", "ీ"), "f": ("త", "ీ"),
    "n": ("ద", "ీ"), "r": ("జ", "ీ"), "s": ("ర", "ీ"), "j": ("శ", "ీ"), "t": ("శ", "ి"),
    "y": ("గ", "ి"), "w": ("గ", "ీ"), "l": ("జ", "ి"), "c": ("బ", "ీ"), "a": ("బ", "ి"),
    "m": ("ళ", "ీ"), "b": ("ల", "ీ"), "d": ("ఖ", "ి"), "p": ("చ", "ీ"), "o": ("ళ", "ి"),
    "v": ("ఖ", "ీ"), "A": ("జ", "ు"), "E": ("జ", "ూ"),
    # independent vowels
    "J": ("అ", ""), "P": ("ఆ", ""), "W": ("ఇ", ""), "D": ("ఈ", ""), "L": ("ఉ", ""),
    "T": ("ఊ", ""), "Z": ("ఎ", ""), "U": ("ఏ", ""), "S": ("ఐ", ""), "X": ("ఒ", ""),
    "F": ("ఓ", ""), "B": ("ఔ", ""),
}
# glyphs that stand for a whole conjunct
SPECIAL_BASES = {"N": ["శ", "ర"], "G": ["స", "త", "ర"]}
SPECIAL_VOWEL = {"N": "ీ", "G": ""}

# Bases drawn as వ / య whose right-hand "hook" (∞ Ú ∂ ¸) turns వ into మ.
HOOK_V = set('="qg')
TALAKATTU = set("¨«Œ°õÆ»◊í")
VOWEL = {
    "å": "ా", "ß": "ా", "ê": "ా", "Ï": "ా", "Í": "ా", "•": "ా", "®": "ా",
    "Ú": "ు", "Ù": "ు", "µ": "ు", "\u2126": "ు", "√": "ు",
    "Ó": "ూ", "¥": "ూ", "Ä": "ూ", "Ø": "ూ",
    "˜": "ి", "≤": "ి", "ç": "ి", "ô": "ీ",
    "©": "ీ", "‘": "ీ",
    "Õ": "ే", "Ë": "ే", "ı": "ే",
    "À": "ో", "’": "ో", "È": "ో", "Ÿ": "ో",
    "⁄": "ొ", "˘": "ొ", "Á": "ొ",
    "“": "ౌ", "ø": "ౌ", "Ò": "ౌ", "œ": "ౌ", "∫": "ౌ",
    "$": "ృ",
}
E_MARK = set("≥‹ˇ")          # ె after the base
AI_MARK = set("·Âÿ")         # turns ె into ై
VATTU = {
    "º": "య", "‡": "మ", "∆": "ష", "Î": "త", "ﬁ": "వ", "ﬂ": "న", "¡": "ల", "¯": "క",
    "Û": "చ", "ú": "ధ", "÷": "థ", "ì": "ట", "ª": "ఠ", "˚": "జ", "˝": "ఞ", "‚": "ణ",
    "æ": "గ", "ƒ": "బ", "Ì": "ద", "Ê": "ప", "¤": "డ", "≈": "శ", "¬": "ష", "§": "ళ",
    "›": "హ", "û": "స", "…": "ఘ", "ö": "ఖ", "]": "ఱ",
}
ASPIRATE = {"క": "ఖ", "గ": "ఘ", "చ": "ఛ", "జ": "ఝ", "ట": "ఠ", "డ": "ఢ", "త": "థ",
            "ద": "ధ", "ప": "ఫ", "బ": "భ"}
VIRAMA_MARKS = set("ü£±ò∑")
PRE_VOWEL = {"ˆ": "ే", "¿": "ే", "Ô": "ె", "Ã": "ె"}
PRE_RA = set("„¢")

# Non-compositional glyph sequences (checked one by one against the scans).
OVERRIDES = {
    "|∞∞": "బు",         # Gowthami draws బు with a doubled hook
    "â∫≈": "శౌ",         # శౌ is drawn in two pieces
}

TELUGU_DIGITS = str.maketrans("", "")


class DecodeError(ValueError):
    pass


def decode_cluster(cl):
    if cl in OVERRIDES:
        return OVERRIDES[cl]
    if cl[:1] in ("O", "ó"):  # ం after an avagraha: తేజోఽంశ, బహవోఽంబు
        return ("ం" if cl[0] == "O" else "ః") + (decode_cluster(cl[1:]) if len(cl) > 1 else "")
    i = 0
    pre_vowel, ra = "", False
    while i < len(cl) and cl[i] in PREFIX:
        if cl[i] in PRE_RA:
            ra = True
        else:
            pre_vowel = PRE_VOWEL[cl[i]]
        i += 1
    if i >= len(cl):
        raise DecodeError(f"no base in {cl!r}")
    b = cl[i]
    i += 1
    if b in SPECIAL_BASES:
        cons, vowel = list(SPECIAL_BASES[b]), SPECIAL_VOWEL[b]
    elif b in BASES:
        c, vowel = BASES[b]
        cons = [c]
    else:
        raise DecodeError(f"unknown base {b!r} in {cl!r}")
    independent = "అ" <= cons[0] <= "ఔ"
    if pre_vowel:
        vowel = pre_vowel
    marks = cl[i:]
    if b == "~" and "≠" in marks:  # ఝ
        cons, marks = ["ఝ"], marks.replace("≠", "")
    if cons[0] == "ర" and "î" in marks:  # ఠ is the ర body with a dot (~î ఠ, iî ఠి)
        cons, marks = ["ఠ"], marks.replace("î", "")
    elif "î" in marks:  # a lone ఠ glyph typed after another syllable (11, note on 2.11)
        return decode_cluster(cl.replace("î", "")) + "ఠ"
    if b == "~" and marks[:1] in ("Ú", "¸"):  # యి / యీ are drawn on the ర body
        cons, vowel, marks = ["య"], "ి" if marks[0] == "Ú" else "ీ", marks[1:]
    hook_v = b in HOOK_V
    hooked = False
    e = False
    mod = ""
    dead = False
    vattus = []
    for m in marks:
        if m in TALAKATTU:
            continue
        if m in PREFIX and m in PRE_RA:  # ra-vattu typed after the base
            ra = True
        elif m == "è":
            cons[0] = ASPIRATE.get(cons[0], cons[0])
        elif m == "¶":
            cons[0] = ASPIRATE.get(cons[0], cons[0])
        elif m == "ä":
            cons[0] = {"ద": "థ"}.get(cons[0], cons[0])
        elif m == "ù":
            if vattus:
                vattus[-1] = ASPIRATE.get(vattus[-1], vattus[-1])
            else:
                cons[0] = ASPIRATE.get(cons[0], cons[0])
        elif m in VATTU:
            vattus.append(VATTU[m])
        elif m == "C":
            vattus.append("ప")
            vowel = "ు"
        elif m == "O":
            mod += "ం"
        elif m == "ó":
            mod += "ః"
        elif m in VIRAMA_MARKS:
            dead = True
        elif m in E_MARK:
            if vowel != "ే":  # ˇ after ే is only a flourish
                e = True
        elif m in AI_MARK:
            vowel = "ై"
        elif b == "Ç" and m in "Ï\uf8ffï˙":
            # హ: Ï is the body's hook; the others are hook + vowel
            vowel = {"Ï": vowel, "\uf8ff": "ా", "ï": "ు", "˙": "ూ"}[m]
        elif m in "∞Ú∂¸" and (hook_v or b == "Ü" or cons[0] == "ఫ") and not hooked:
            # the right-hand hook of మ / య / ఘ, alone or fused with a vowel
            hooked = True
            if m == "Ú":
                vowel = "ొ" if e else "ు"
            elif m == "∂":
                vowel = "ో" if e else "ా"
            elif m == "¸":
                vowel = "ూ"
            if m != "∞":
                e = False
        elif m == "∞":
            vowel = "ు"
        elif m == "Ú":
            vowel = "ొ" if e else "ు"
            e = False
        elif m == "∂":
            vowel = "ో" if e else "ూ"
            e = False
        elif m == "¸":
            vowel = "ూ"
        elif m == "Ï" and vowel == "ృ":
            vowel = "ౄ"
        elif m in VOWEL:
            vowel = VOWEL[m]
        else:
            raise DecodeError(f"unknown mark {m!r} in {cl!r}")
    if e:
        vowel = "ై" if vowel == "ై" else "ె"
    if hook_v and hooked:
        cons[0] = "మ"
    if hooked and cons[0] == "ఫ":  # ఘ is ఫ with the hook
        cons[0] = "ఘ"
    if independent:
        if vattus or ra or vowel:
            raise DecodeError(f"vowel with marks {cl!r}")
        return cons[0] + mod
    seq = cons[:1]
    for c in cons[1:]:
        seq += [VIRAMA, c]
    # The ra-vattu is drawn apart from the other vattus; in speech it follows the
    # stops and precedes a final య/వ (త్ర్య, ష్ట్ర, స్త్ర).
    if vattus[-2:] == ["త", "క"]:
        vattus[-2:] = ["క", "త"]  # typed త-vattu first, read ఙ్క్త (భుఙ్క్తే)
    tail = []
    while vattus and vattus[-1] in "యవ" and ra and len(vattus) + len(cons) > 1:
        tail.insert(0, vattus.pop())
    for v in vattus:
        seq += [VIRAMA, v]
    if ra:
        seq += [VIRAMA, "ర"]
    for v in tail:
        seq += [VIRAMA, v]
    out = "".join(seq)
    if dead:
        out += VIRAMA
    else:
        out += vowel
    return out + mod


# Punctuation of the Anu fonts
PUNCT_MAP = {
    "†": ";", "´": "=", "—": "’", "'": "‘", "{": "+",
}


def decode_word(w):
    """Decode one glyph word (no spaces). Punctuation is kept in place."""
    out, cur = [], ""

    def flush():
        nonlocal cur
        if cur:
            out.append(cur)
            cur = ""

    parts = []
    for c in w:
        if c in PUNCT or c.isdigit() or c == "I":
            flush_parts(parts, cur)
            cur = ""
            parts.append(("p", c))
        else:
            cur += c
    flush_parts(parts, cur)
    res = []
    for kind, s in parts:
        if kind == "p":
            res.append(s)
        else:
            cls = split_clusters(s)
            # a bare ర body inside a word is the book's ం (2.62 పుంసః, checked on the scan)
            res.append("".join("ం" if cl == "~" and k < len(cls) - 1 else decode_cluster(cl) for k, cl in enumerate(cls)))
    text = "".join(res)
    text = text.replace("II", "॥").replace("I", "।")
    return "".join(PUNCT_MAP.get(c, c) for c in text)


def flush_parts(parts, cur):
    if cur:
        parts.append(("t", cur))


def split_clusters(s):
    out, cur, pre = [], "", ""
    for c in s:
        if c in PREFIX and not (c in "„¢" and cur and False):
            if cur:
                out.append(cur)
                cur = ""
            pre += c
        elif c in BASE or c in SPECIAL_BASES:
            if cur:
                out.append(cur)
            cur, pre = pre + c, ""
        else:
            if cur:
                cur += c
            elif out and pre and all(p in PRE_RA for p in pre):
                out[-1] += c  # ం typed after the next syllable's ra-vattu
            else:
                pre += c
    if cur or pre:
        out.append(cur + pre)
    return out


# The book types ఋ with the glyphs of బు (they look alike). Restore it where the
# word cannot be Telugu/Sanskrit బు: ఋషి, ఋషభ, ఋతు, ఋత, ఋక్, ఋగ్వేద, ఋజు, ఋచ్ఛతి, ఋణ.
RV_FIXES = [
    (re.compile(r"బు(?=ష)"), "ఋ"),
    (re.compile(r"బు(?=చ్ఛ)"), "ఋ"),
    (re.compile(r"(?<![\u0c00-\u0c7f])బు(?=త|క్|గ్|జు|ణ)"), "ఋ"),
]


def fix_rv(text):
    for rx, rep in RV_FIXES:
        text = rx.sub(rep, text)
    return text


def decode(text):
    text = repair(text)
    return fix_rv(re.sub(r"[^ \u00a0]+", lambda m: decode_word(m.group(0)), text))
