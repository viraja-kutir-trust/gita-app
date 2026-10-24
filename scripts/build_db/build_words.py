"""Word-level data:
  * DCS (CC BY 4.0) word analysis per verse -> words.json
    {verse_id, idx, form, unsandhied, form_dev, lemma, lemma_dev, pos, morph, feats}
  * legacy 'word—meaning; …' strings parsed -> word_meanings.json
    {verse_id, idx, term_legacy, term_iast, term_dev, meaning, in_verse, dcs_idx[]}
"""
import json
import os
import re
import sys
import unicodedata
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
import deva as D  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "scripts", "out", "build")

POS = {"NOUN": "noun", "VERB": "verb", "PRON": "pronoun", "ADJ": "adjective", "PART": "particle", "ADV": "adverb",
       "CONJ": "conjunction", "CCONJ": "conjunction", "SCONJ": "subordinating conjunction", "NUM": "numeral",
       "INTJ": "interjection", "ADP": "adposition", "PROPN": "proper noun", "DET": "determiner"}
FEAT = {
    "Case": {"Nom": "nominative", "Acc": "accusative", "Ins": "instrumental", "Dat": "dative", "Abl": "ablative",
             "Gen": "genitive", "Loc": "locative", "Voc": "vocative", "Cpd": "compound member"},
    "Number": {"Sing": "singular", "Dual": "dual", "Plur": "plural"},
    "Gender": {"Masc": "masculine", "Fem": "feminine", "Neut": "neuter"},
    "Person": {"1": "1st person", "2": "2nd person", "3": "3rd person"},
    "Tense": {"Pres": "present", "Past": "past", "Fut": "future", "Impf": "imperfect", "Aor": "aorist", "Perf": "perfect"},
    "Mood": {"Ind": "indicative", "Imp": "imperative", "Opt": "optative", "Cond": "conditional", "Jus": "injunctive"},
    "Voice": {"Pass": "passive", "Act": "active", "Mid": "middle"},
    "VerbForm": {"Part": "participle", "Conv": "absolutive (gerund)", "Inf": "infinitive", "Gdv": "gerundive"},
    "Formation": {"peri": "periphrastic", "s": "s-aorist"},
}
ORDER = ["VerbForm", "Person", "Tense", "Mood", "Voice", "Case", "Number", "Gender", "Formation"]


def readable(upos, feats):
    f = dict(x.split("=", 1) for x in (feats or "").split("|") if "=" in x)
    parts = [POS.get(upos, upos.lower())]
    for k in ORDER:
        if k in f:
            parts.append(FEAT.get(k, {}).get(f[k], f[k].lower()))
    return " · ".join(parts)


def legacy_to_iast(s):
    """gita/gita word-meaning romanisation (ch, chh, śh, ṣh, ṛi, ṁ) -> IAST."""
    s = unicodedata.normalize("NFC", s.strip())
    s = s.replace("’", "'").replace("‘", "'")
    s = s.replace("chchh", "cch").replace("chh", "\x01").replace("ch", "c").replace("\x01", "ch")
    s = s.replace("śh", "ś").replace("ṣh", "ṣ").replace("ṛi", "ṛ").replace("ṝi", "ṝ").replace("ḷi", "ḷ")
    s = s.replace("ṁ", "ṃ")
    return s


def key(s):
    s = D.fold_ascii(s.replace("-", "").replace("'", ""))
    s = re.sub(r"[^a-z]", "", s)
    return re.sub(r"(h|m|n|s|r|t|d)$", "", s)  # final visarga / m / sandhi consonant


def parse_meanings(wm):
    items = []
    for it in re.split(r"\s*;\s*|\s*\n\s*", wm.strip()):
        it = it.strip()
        if not it:
            continue
        if "—" in it:
            term, meaning = it.split("—", 1)
        else:
            m = re.match(r"^(.*[āīūṛṝṅñṭḍṇśṣḥṁṃ][^\s-]*)-([a-z].*)$", it) or re.match(r"^([^\s-]+)-([a-z][a-z ,()]+)$", it)
            if m:
                term, meaning = m.group(1), m.group(2)
            else:
                term, meaning = it, ""
        items.append((term.strip(), meaning.strip()))
    return items


def main():
    verses = json.load(open(os.path.join(OUT, "verses.json")))
    dcs = {(r["chapter"], r["verse_701"]): r for r in
           json.load(open(os.path.join(ROOT, "scripts", "out", "opensource", "dcs-conllu", "dcs_gita_verses.json")))}
    words, meanings = [], []
    st = Counter()
    for v in verses:
        rec = dcs.get((v["chapter"], v["verse"]))
        dw = []
        if rec:
            for i, w in enumerate(rec["words"]):
                dw.append(dict(verse_id=v["id"], idx=i, form=w["form"], unsandhied=w.get("unsandhied") or w["form"],
                               form_dev=D.iast_to_deva(w.get("unsandhied") or w["form"]), lemma=w["lemma"],
                               lemma_dev=D.iast_to_deva(w["lemma"]), pos=POS.get(w["upos"], w["upos"].lower()),
                               morph=readable(w["upos"], w.get("feats")), feats=w.get("feats") or ""))
            words += dw
            st["dcs_verses"] += 1
        verse_norm = D.norm("".join(v["padas"]) + (v["speaker"] or ""))
        items = parse_meanings(v["word_meanings_legacy"])
        j = 0
        for idx, (term, meaning) in enumerate(items):
            if "\n" in term or len(term) > 60:
                st["dropped_junk_item"] += 1
                continue
            iast = legacy_to_iast(term)
            dev = D.iast_to_deva(iast)
            in_verse = D.norm(dev.replace("-", "")) in verse_norm
            # align to DCS: concatenation of 1-4 consecutive unsandhied forms, searching ahead of the pointer
            match = None
            k_t = key(iast)
            for start in list(range(j, min(j + 8, len(dw)))) + list(range(0, j)):
                acc = ""
                for n in range(1, 5):
                    if start + n > len(dw):
                        break
                    acc += dw[start + n - 1]["unsandhied"]
                    if key(acc) == k_t and k_t:
                        match = list(range(start, start + n))
                        break
                if match:
                    break
            src = "legacy"
            if match:
                j = match[-1] + 1
                st["aligned_to_dcs"] += 1
                # rebuild the term from DCS's (proof-read IAST) forms, keeping the item's separators
                seps = re.findall(r"[- ]", term)
                forms = [dw[k]["unsandhied"] for k in match]
                if len(seps) == len(forms) - 1:
                    rebuilt = forms[0] + "".join(sp + f for sp, f in zip(seps, forms[1:]))
                elif not seps:
                    rebuilt = "".join(forms)
                else:
                    rebuilt = iast  # keep the item's own compound hyphenation
                if key(rebuilt) == key(iast):
                    if rebuilt != iast:
                        st["term_spelling_from_dcs"] += 1
                    iast, src = rebuilt, "dcs"
                    dev = D.iast_to_deva(iast)
            st["items"] += 1
            st["in_verse"] += in_verse
            meanings.append(dict(verse_id=v["id"], idx=idx, term_legacy=term, term_iast=iast, term_dev=dev,
                                 meaning=meaning, in_verse=int(in_verse), dcs_idx=match or [], term_source=src))
    json.dump(words, open(os.path.join(OUT, "words.json"), "w"), ensure_ascii=False)
    json.dump(meanings, open(os.path.join(OUT, "word_meanings.json"), "w"), ensure_ascii=False)
    print("words:", len(words), "meanings:", dict(st))


if __name__ == "__main__":
    main()
