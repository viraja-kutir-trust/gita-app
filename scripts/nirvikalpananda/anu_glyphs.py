"""Glyph classes of the Anu Telugu fonts (Priyaanka, Gowthami, Pragathi, Kranthi, Pallavi)
used in the Nirvikalpananda PDFs. The text layer maps each glyph to a Latin-1/MacRoman
code point; these sets describe the role of each code point.

A written syllable is typed as   [prefix…] base [mark…]
  prefix: ra-vattu and the left-hand e/ai/u signs that sit before the base glyph
  base:   a consonant body, an independent vowel or a consonant+vowel ligature
  mark:   talakattu, vowel signs, vattus (subscript consonants), ం ః and virama
"""
import re

PREFIX = set("„¢ˆ¿ÃÔ")
BASE = set("HQK[*_}`^#Ñá|É=\"Ü~Åã™â+ëÇÖYM>\\@<Véà&JPWDLFUZXSTBEANxqkzuehigfnrsjtywlcambdpovG‰")
PUNCT = set(",.†´:;!?()'—–-{/")  # '[' is the ja base, '}' is ణ, ']' is the ఱ vattu
DIGITS = set("0123456789")
SPACE = set("  \t")


def is_telugu_glyph(c):
    return c not in PUNCT and c not in DIGITS and c not in SPACE and c not in "I"


def clusters(word):
    """Split a glyph word into syllable clusters (strings). Punctuation is dropped."""
    out, cur, pre = [], "", ""
    for c in word:
        if not is_telugu_glyph(c):
            continue
        if c in PREFIX:
            if cur:
                out.append(cur)
                cur = ""
            pre += c
        elif c in BASE:
            if cur:
                out.append(cur)
            cur, pre = pre + c, ""
        else:
            if cur:
                cur += c
            else:  # stray mark (e.g. a mark typed before its base); keep with prefix
                pre += c
    if cur or pre:
        out.append(cur + pre)
    return out


TE_C = "క-హౘ-ౚ"
AKSHARA = re.compile(rf"(?:[{TE_C}]్)*[{TE_C}](?:[ా-ౌౕౖ]|్(?![{TE_C}]))?[ఀ-ః]*|[అ-ఔౠౡ][ఀ-ః]*")


def aksharas(s):
    s = s.replace("‌", "").replace("‍", "")
    return AKSHARA.findall(s)


def is_mark(c):
    return is_telugu_glyph(c) and c not in BASE and c not in PREFIX


def repair(raw):
    """Re-attach marks that the typesetter separated from their syllable with a space
    (or that a comma was typed in front of): 'ã¨#ﬂ ºã¨' -> 'ã¨#ﬂºã¨', 'k,è' -> 'kè,'."""
    out = [c for c in raw if c >= " "]
    i = 0
    while i < len(out):
        c = out[i]
        if is_mark(c) and i > 0 and (out[i - 1] in SPACE or out[i - 1] in ",."):
            j = i - 1
            while j >= 0 and (out[j] in SPACE or out[j] in ",."):
                j -= 1
            if j >= 0 and is_telugu_glyph(out[j]):
                # a stray full stop inside a word is a typo; a comma stays after the word
                sep = "".join(out[j + 1:i]).replace(" ", "").replace("\u00a0", "").replace(".", "")
                out[j + 1:i + 1] = [c] + list(sep)
                i = j + 1
        i += 1
    return "".join(out)
