"""Task 3: clean translations/commentaries, add the public-domain translations
(Besant 1922, Andhra Bhagavadgita 1911, Bharathi) and the author metadata.

Output: scripts/out/build/texts.json, authors.json, sources.json, clean_stats.json
Body format: paragraphs separated by "\n\n"; a single "\n" is a line break
inside a paragraph (used for poetry, e.g. Telugu padyas).
"""
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
import textfix as TF  # noqa: E402
import html as htmlmod  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "src", "gita-data")
OS_DIR = os.path.join(ROOT, "scripts", "out", "opensource")
OUT_DIR = os.path.join(ROOT, "scripts", "out", "build")

GITA_GITA = "https://github.com/gita/gita"
SUPERSITE = "https://www.gitasupersite.iitk.ac.in"
LIC_MODERN = ("Copyright the translator/publisher. Bundled from the gita/gita dataset (sourced from the "
              "IIT Kanpur Gita Supersite) for non-profit, ad-free educational use with attribution.")
LIC_CLASSICAL = ("Classical work (public domain). Digital text from the IIT Kanpur Gita Supersite via the "
                 "gita/gita dataset; used for non-profit educational purposes with attribution.")

# id: (name, lang, tradition, era, license, attribution, source_url, work)
AUTHOR_META = {
    1: ("Swami Ramsukhdas", "hindi", "Modern (Gita Press)", "20th c.", LIC_MODERN, "Swami Ramsukhdas, Sadhak Sanjivani (Gita Press, Gorakhpur)", SUPERSITE, "Sadhak Sanjivani"),
    2: ("Swami Chinmayananda", "hindi", "Modern (Advaita, Chinmaya Mission)", "20th c.", LIC_MODERN, "Swami Chinmayananda (Hindi rendering), Central Chinmaya Mission Trust", SUPERSITE, "The Holy Geeta"),
    3: ("Sri Anandgiri", "sanskrit", "Advaita", "13th c.", LIC_CLASSICAL, "Anandagiri, sub-commentary (tika) on Shankara's Gita Bhashya", SUPERSITE, "Gita Bhashya Vivechana"),
    4: ("Sri Dhanpati", "sanskrit", "Advaita", "18th c.", LIC_CLASSICAL, "Dhanapati Suri, Bhashyotkarsha Dipika", SUPERSITE, "Bhashyotkarsha Dipika"),
    5: ("Sri Madhavacharya", "sanskrit", "Dvaita", "13th c.", LIC_CLASSICAL, "Sri Madhvacharya, Gita Bhashya", SUPERSITE, "Gita Bhashya"),
    6: ("Sri Neelkanth", "sanskrit", "Advaita", "17th c.", LIC_CLASSICAL, "Nilakantha Chaturdhara, Bhava Dipika", SUPERSITE, "Bhava Dipika"),
    7: ("Sri Ramanujacharya", "sanskrit", "Vishishtadvaita", "11th-12th c.", LIC_CLASSICAL, "Sri Ramanujacharya, Gita Bhashya", SUPERSITE, "Gita Bhashya"),
    8: ("Sri Sridhara Swami", "sanskrit", "Advaita (Bhakti)", "14th c.", LIC_CLASSICAL, "Sridhara Swami, Subodhini", SUPERSITE, "Subodhini"),
    9: ("Sri Vedantadeshikacharya Venkatanatha", "sanskrit", "Vishishtadvaita", "13th-14th c.", LIC_CLASSICAL, "Vedanta Desika, Tatparya Chandrika", SUPERSITE, "Tatparya Chandrika"),
    10: ("Sri Abhinavgupta", "sanskrit", "Kashmir Shaiva", "10th-11th c.", LIC_CLASSICAL, "Abhinavagupta, Gitartha Sangraha", SUPERSITE, "Gitartha Sangraha"),
    11: ("Sri Jayatritha", "sanskrit", "Dvaita", "14th c.", LIC_CLASSICAL, "Jayatirtha, Prameya Dipika", SUPERSITE, "Prameya Dipika"),
    12: ("Sri Madhusudan Saraswati", "sanskrit", "Advaita", "16th c.", LIC_CLASSICAL, "Madhusudana Sarasvati, Gudhartha Dipika", SUPERSITE, "Gudhartha Dipika"),
    13: ("Sri Purushottamji", "sanskrit", "Shuddhadvaita", "17th-18th c.", LIC_CLASSICAL, "Purushottama Goswami, Amrita Tarangini", SUPERSITE, "Amrita Tarangini"),
    14: ("Sri Shankaracharya", "sanskrit", "Advaita", "8th c.", LIC_CLASSICAL, "Adi Shankaracharya, Gita Bhashya", SUPERSITE, "Gita Bhashya"),
    15: ("Sri Vallabhacharya", "sanskrit", "Shuddhadvaita", "15th-16th c.", LIC_CLASSICAL, "Vallabhacharya (Tattvadipika tradition)", SUPERSITE, "Tattvadipika"),
    16: ("Swami Sivananda", "english", "Modern (Advaita / Yoga)", "20th c.", LIC_MODERN, "Swami Sivananda, The Bhagavad Gita (Divine Life Society)", SUPERSITE, "The Bhagavad Gita"),
    17: ("Swami Tejomayananda", "hindi", "Modern (Chinmaya Mission)", "20th-21st c.", LIC_MODERN, "Swami Tejomayananda, Central Chinmaya Mission Trust", SUPERSITE, "Hindi translation"),
    18: ("Swami Adidevananda", "english", "Vishishtadvaita (translation of Ramanuja)", "20th c.", LIC_MODERN, "Swami Adidevananda, Sri Ramanuja Gita Bhashya (Sri Ramakrishna Math)", SUPERSITE, "Sri Ramanuja Gita Bhashya"),
    19: ("Swami Gambhiranda", "english", "Advaita (translation of Shankara)", "20th c.", LIC_MODERN, "Swami Gambhirananda, Bhagavad Gita with the commentary of Sankaracharya (Advaita Ashrama)", SUPERSITE, "Gita with Shankara Bhashya"),
    20: ("Dr. S. Sankaranarayan", "english", "Kashmir Shaiva (translation of Abhinavagupta)", "20th c.", LIC_MODERN, "Dr. S. Sankaranarayan, Gitartha Sangraha of Abhinavagupta (English)", SUPERSITE, "Gitartha Sangraha (English)"),
    21: ("Shri Purohit Swami", "english", "Modern", "20th c. (1935)", LIC_MODERN, "Shri Purohit Swami, The Geeta (Faber & Faber, 1935)", SUPERSITE, "The Geeta"),
    22: ("Swami Nirvikalpananda", "telugu", "Modern", "20th-21st c.", LIC_MODERN, "Swami Nirvikalpananda", GITA_GITA, "Telugu translation (partial)"),
}

NEW_AUTHORS = {
    23: dict(name="Annie Besant (1922)", lang="english", kind="translation", tradition="Modern (Theosophical)", era="1922 (4th ed.)",
             license="Public domain (Annie Besant d. 1933; 1922 edition; Wikisource PD-old / PD-US)",
             attribution="Annie Besant, The Bhagavad-Gita or The Lord's Song, 4th ed. 1922. Transcribed by Wikisource contributors.",
             source_url="https://en.wikisource.org/wiki/Bhagavad-Gita_(Besant_4th)", work="The Lord's Song"),
    24: dict(name="Taduri Lakshminarasimha Raya Kavi", lang="telugu", kind="translation", tradition="Modern (Telugu padya kavya)", era="1911",
             license="Public domain (published 1911; te.wikisource PD-India, PD in the US)",
             attribution="తాడూరి లక్ష్మీనరసింహరాయకవి, ఆంధ్ర భగవద్గీత (1911) — Telugu metrical (padya) rendering, via te.wikisource. Padya numbering follows the poet; aligned to verse numbers.",
             source_url="https://te.wikisource.org/wiki/ఆంధ్ర_భగవద్గీత", work="ఆంధ్ర భగవద్గీత (Andhra Bhagavadgita)"),
    25: dict(name="Subramania Bharathi", lang="tamil", kind="translation", tradition="Modern", era="early 20th c.",
             license="Translation public domain (Subramania Bharathi d. 1921; works nationalised by Tamil Nadu). E-text © Project Madurai: free distribution provided the header is kept intact.",
             attribution="மகாகவி சுப்ரமணிய பாரதியார், பகவத் கீதை (தமிழ் மொழிபெயர்ப்பு). E-text: Project Madurai (pm0529), input & proof-reading Dr. K. Kalyanasundaram.",
             source_url="https://www.projectmadurai.org/pm_etexts/utf8/pmuni0529.html", work="பகவத் கீதை"),
}

# ------------------------------------------------------------------ pipeline
def clean_poem(text, fx):
    out = []
    for l in unicodedata.normalize("NFC", text).split("\n"):
        l2 = re.sub(r"[ \t\xa0]{2,}", " ", l).strip()
        if not l2:
            continue
        l2 = fx.sub("dash: '--' -> em dash", r"\s*-{2,}\s*", " — ", l2)
        l2 = TF.smart_quotes(l2, fx)
        l2 = re.sub(r"\s+([?!,;])", r"\1", l2)
        l2 = fx.sub("punct: stray full stop after ॥", r"॥\.", "॥", l2).strip()
        out.append(l2)
    return "\n".join(out)


def quote_odd(raw):
    r = raw or ""
    return int((r.count('"') + r.count("“") + r.count("”")) % 2 == 1 or (r.count("'") + r.count("‘")) % 2 == 1
               or r.count("“") != r.count("”"))


def clean_summary(t, lang, fx):
    blocks, plain, _ = TF.clean_entry(t, lang, 0, "commentary", [], fx)
    return blocks, plain


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    verses = json.load(open(os.path.join(DATA, "verse.json")))
    built = {r["id"]: r for r in json.load(open(os.path.join(OUT_DIR, "verses.json")))}
    vid = {(v["chapter_number"], v["verse_number"]): v["id"] for v in verses}
    fx = TF.Fixer()
    texts, entries = [], []
    kinds = defaultdict(set)
    for fname, typ in (("translation.json", "translation"), ("commentary.json", "commentary")):
        for r in json.load(open(os.path.join(DATA, fname))):
            fx.author = r["author_id"]
            fx.counts[fx.author]["rows"] += 0
            blocks, plain, ph = TF.clean_entry(r["description"], r["lang"], r["author_id"], typ,
                                               built[r["verse_id"]]["padas"], fx)
            if not blocks:
                fx.log("junk: empty entry dropped", r["description"][:40], "")
                continue
            texts.append(dict(verse_id=r["verse_id"], verse_id_end=r["verse_id"], author_id=r["author_id"],
                              type=typ, lang=r["lang"], blocks=blocks, body=plain, placeholder=ph,
                              src_quote_odd=quote_odd(r["description"])))
            entries.append(dict(author=r["author_id"], verse_id=r["verse_id"], type=typ, raw=r["description"],
                                blocks=blocks, score=fx.entry_score))
            kinds[r["author_id"]].add(typ)

    def add(aid, v1, v2, lang, body_blocks, raw):
        plain = "\n\n".join(TF.plain_of(b) for b in body_blocks)
        texts.append(dict(verse_id=v1, verse_id_end=v2, author_id=aid, type="translation", lang=lang,
                          blocks=body_blocks, body=plain, placeholder=0, src_quote_odd=quote_odd(raw)))
        entries.append(dict(author=aid, verse_id=v1, type="translation", raw=raw, blocks=body_blocks, score=fx.entry_score))

    # Besant 1922 (English, PD)
    fx.author = 23
    for r in json.load(open(os.path.join(OS_DIR, "besant-1922-wikisource", "besant_1922.json"))):
        blocks, _, _ = TF.clean_entry(r["en"], "english", 23, "translation", [], fx)
        add(23, vid[(r["chapter"], r["verse"])], vid[(r["chapter"], r["verse"])], "english", blocks, r["en"])
    # Andhra Bhagavadgita 1911 (Telugu padya, PD) -- keep the poem's line breaks
    fx.author = 24
    andhra = json.load(open(os.path.join(OS_DIR, "telugu-andhra-bhagavadgita-1911", "andhra_bhagavadgita_1911.json")))
    for r in andhra["verses"]:
        fx.entry_score = 0
        poem = clean_poem(r["text"], fx)
        lines = poem.split("\n")
        # prose cue lines ('అనుటయు సంజయుండిట్లనియె.') before the metre marker stay a paragraph
        k = next((i for i, l in enumerate(lines) if "॥" in l), 0)
        blocks = []
        if k:
            blocks.append({"type": "paragraph", "text": " ".join(lines[:k])})
        blocks.append({"type": "verse_quote", "lines": lines[k:], "text": " ".join(lines[k:]), "meter": "padya"})
        add(24, vid[(r["chapter"], r["verse"])], vid[(r["chapter"], r["verse"])], "telugu", blocks, r["text"])
    # Bharathi (Tamil, PD) -- grouped verses stored once with a verse range
    fx.author = 25
    tam = json.load(open(os.path.join(OS_DIR, "tamil-bharathiyar-pm0529", "bharathi_gita_ta.json")))
    seen = set()
    for it in tam["items"]:
        ids = [vid[(it["chapter"], v)] for v in it["verses"]]
        k = (min(ids), max(ids))
        if k in seen:
            continue
        seen.add(k)
        blocks, _, _ = TF.clean_entry(it["ta"], "tamil", 25, "translation", [], fx)
        add(25, k[0], k[1], "tamil", blocks, it["ta"])
    for t in texts:
        t["word_count"] = len(re.findall(r"\S+", t["body"]))

    # chapter summaries
    chapters = json.load(open(os.path.join(DATA, "chapters.json")))
    fx.author = "chapters"
    ch_out = []
    for c in chapters:
        be, pe = clean_summary(c["chapter_summary"], "english", fx)
        entries.append(dict(author="chapters", verse_id=c["chapter_number"], type="summary_en", raw=c["chapter_summary"], blocks=be, score=fx.entry_score))
        bh, ph_ = clean_summary(c["chapter_summary_hindi"], "hindi", fx)
        entries.append(dict(author="chapters", verse_id=c["chapter_number"], type="summary_hi", raw=c["chapter_summary_hindi"], blocks=bh, score=fx.entry_score))
        ch_out.append(dict(number=c["chapter_number"], name_sa=c["name"].strip(), name_translit=c["name_transliterated"].strip(),
                           name_en=c["name_translation"].strip(), meaning=c["name_meaning"].strip(),
                           summary_en=pe, summary_hi=ph_, summary_en_blocks=be, summary_hi_blocks=bh,
                           verse_count=c["verses_count"], image_name=c.get("image_name"),
                           src_quote_odd_en=quote_odd(c["chapter_summary"]), src_quote_odd_hi=quote_odd(c["chapter_summary_hindi"])))

    authors = []
    for aid, (name, lang, trad, era, lic, attr, url, work) in AUTHOR_META.items():
        k = kinds[aid]
        authors.append(dict(id=aid, name=name, lang=lang, kind="both" if len(k) == 2 else (next(iter(k)) if k else "translation"),
                            tradition=trad, era=era, license=lic, attribution=attr, source_url=url, work=work,
                            public_domain=1 if lic == LIC_CLASSICAL else 0))
    for aid, a in NEW_AUTHORS.items():
        authors.append(dict(id=aid, public_domain=1, **a))

    pm_header = tam["project_madurai_header"]
    pm_header = re.sub(r"(?m)^\s*[a-z0-9.:_\- ]+\s*\{[^}]*\}\s*$", "", re.sub(r"\{[^}]*\}", "{}", pm_header))
    pm_header = "\n".join(l.strip() for l in pm_header.replace("﻿", "").split("\n")
                          if l.strip() and not re.match(r"^[\w.:\-]+\s*\{\}$", l.strip()) and "{" not in l)
    sources = [
        dict(id="gita-gita", name="gita/gita dataset", license="Unlicense (compilation); texts remain with their authors/publishers",
             attribution="Verse text, transliteration, word meanings, translations and commentaries compiled by github.com/gita/gita (from the IIT Kanpur Gita Supersite).", url=GITA_GITA),
        dict(id="besant-sanskrit", name="Besant 1922 Sanskrit text", license="Public domain",
             attribution="Devanagari text of the Besant 1922 edition (Wikisource), used to proof-read verse text and line breaks.", url=NEW_AUTHORS[23]["source_url"]),
        dict(id="dcs", name="Digital Corpus of Sanskrit (DCS)", license="CC BY 4.0",
             attribution="Word analysis (lemma, part of speech, morphology): The Digital Corpus of Sanskrit (DCS), Oliver Hellwig, 2010-2024, CC BY 4.0.",
             url="https://github.com/OliverHellwig/sanskrit"),
        dict(id="project-madurai", name="Project Madurai e-text pm0529", license="Free distribution with header intact",
             attribution=pm_header, url=NEW_AUTHORS[25]["source_url"]),
        dict(id="andhra-intro", name="ఆంధ్ర భగవద్గీత — poet's introduction", license="Public domain",
             attribution=andhra.get("poet_introduction", ""), url=NEW_AUTHORS[24]["source_url"]),
        dict(id="audio", name="Verse recitation audio", license="See gita/gita repository",
             attribution="Per-verse recitation from the gita/gita repository, streamed via jsDelivr.", url=GITA_GITA),
    ]
    json.dump(texts, open(os.path.join(OUT_DIR, "texts.json"), "w"), ensure_ascii=False)
    json.dump(ch_out, open(os.path.join(OUT_DIR, "chapters.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(authors, open(os.path.join(OUT_DIR, "authors.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(sources, open(os.path.join(OUT_DIR, "sources.json"), "w"), ensure_ascii=False, indent=1)
    json.dump({str(k): dict(v) for k, v in fx.counts.items()}, open(os.path.join(OUT_DIR, "clean_stats.json"), "w"), indent=1, ensure_ascii=False)
    write_report(fx, texts, authors)
    write_review(entries, authors)
    print("texts:", len(texts), "blocks:", Counter(b["type"] for t in texts for b in t["blocks"]))


def write_report(fx, texts, authors):
    names = {a["id"]: a["name"] for a in authors}
    names["chapters"] = "Chapter summaries"
    p = os.path.join(ROOT, "scripts", "out", "text_cleanup_report.md")
    with open(p, "w") as f:
        f.write("# Text cleanup report (translations, commentaries, chapter summaries)\n\n")
        f.write("Generated by `scripts/build_db/clean_texts.py` (rules in `textfix.py`). Only typographic "
                "normalisation was applied: no rewording. Whitespace-only changes (space runs, NBSP, tabs, "
                "line wrapping) are not itemised.\n\n")
        bt = Counter(b["type"] for t in texts for b in t["blocks"])
        f.write("Blocks produced: %s\n\n" % dict(bt))
        f.write("Placeholders (\"did not comment\" etc., flagged `placeholder=1`): %d\n\n"
                % sum(t["placeholder"] for t in texts))
        tot = Counter()
        for a, c in fx.counts.items():
            tot.update(c)
        f.write("## Totals by category\n\n| category | count |\n|---|---|\n")
        for k, v in sorted(tot.items(), key=lambda kv: -kv[1]):
            if v:
                f.write("| %s | %d |\n" % (k, v))
        f.write("\n## Per author\n\n")
        for a in sorted(fx.counts, key=lambda x: (isinstance(x, str), x)):
            c = fx.counts[a]
            if not sum(c.values()):
                continue
            f.write("### %s (%s)\n\n" % (names.get(a, a), a))
            for k, v in sorted(c.items(), key=lambda kv: -kv[1]):
                if not v:
                    continue
                f.write("- **%s**: %d\n" % (k, v))
                for b_, a_ in fx.samples[a][k][:3]:
                    f.write("  - `%s` → `%s`\n" % (b_.replace("\n", "⏎").replace("`", "'"), a_.replace("\n", "⏎").replace("`", "'")))
            f.write("\n")
        f.write("## Consciously left as-is\n\n"
                "- Source spelling variants and typos that are not mechanical (e.g. `युक्त्ताहार`, `etnernal`), "
                "Hindi `श्रृ` spellings, and missing/odd sandhi spacing inside commentaries.\n"
                "- Footnote markers `(टिप्पणी प॰ n.m)` in Swami Ramsukhdas: the footnote texts are not in the dataset, "
                "so markers stay inline (tidied); no footnote blocks could be created.\n"
                "- Verse 18.2 (id 625): the source has only placeholder strings (\"Hindi Commentary By …\") for every "
                "commentary and for Ramsukhdas' translation; flagged as placeholders.\n"
                "- Telugu padyas keep the poet's line breaks and metre markers (కం॥, సీ॥ …).\n")


def write_review(entries, authors):
    """~40 before/after renderings: 2 per author (worst + typical) + summaries."""
    names = {a["id"]: a["name"] for a in authors}
    names["chapters"] = "Chapter summaries"
    by = defaultdict(list)
    for e in entries:
        by[e["author"]].append(e)
    pick = []
    for a, es in by.items():
        es = sorted(es, key=lambda e: -e["score"])
        pick.append(es[0])
        mid = es[len(es) // 2]
        if mid is not es[0]:
            pick.append(mid)
        # also one with a verse_quote if present
        vq = next((e for e in es if any(b["type"] == "verse_quote" for b in e["blocks"]) and e not in pick), None)
        if vq and a != 24:
            pick.append(vq)
    os.makedirs(os.path.join(ROOT, "scripts", "out", "review"), exist_ok=True)
    esc = htmlmod.escape

    def render(blocks):
        out = []
        for b in blocks:
            if b["type"] == "heading":
                out.append("<h4>%s</h4>" % esc(b["text"]))
            elif b["type"] == "verse_quote":
                out.append("<blockquote class=vq>%s%s</blockquote>" % ("<br>".join(esc(l) for l in b["lines"]),
                           ("<div class=ref>(%s)</div>" % esc(b["ref"])) if b.get("ref") else ""))
            else:
                t = esc(b["text"]).replace(TF.PRATIKA_OPEN, "<b>").replace(TF.PRATIKA_CLOSE, "</b>")
                lab = ("<span class=lbl>%s</span> " % esc(b["label"])) if b.get("label") else ""
                out.append("<p>%s%s</p>" % (lab, t))
        return "\n".join(out)

    rows = []
    for e in pick:
        raw = esc(e["raw"]).replace("\n", "<span class=ws>⏎</span><br>").replace("\xa0", "<span class=ws>⍽</span>").replace("\t", "<span class=ws>⇥</span>")
        rows.append("<section><h3>%s · %s · %s <small>messiness %d</small></h3><div class=grid><div><h5>Before (raw)</h5><pre>%s</pre></div>"
                    "<div><h5>After (blocks)</h5>%s<details><summary>JSON</summary><pre>%s</pre></details></div></div></section>"
                    % (esc(str(names.get(e["author"], e["author"]))), esc(e["type"]), e["verse_id"], e["score"], raw,
                       render(e["blocks"]), esc(json.dumps(e["blocks"], ensure_ascii=False, indent=1))))
    page = """<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Text cleanup review</title><style>
:root{--bg:#fff;--fg:#1d1d1f;--mut:#666;--line:#ddd;--card:#f7f7f8}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--fg:#eee;--mut:#aaa;--line:#333;--card:#1e1e22}}
body{background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,'Noto Sans Devanagari','Noto Sans Telugu','Noto Sans Tamil',sans-serif;margin:0 auto;max-width:1300px;padding:16px}
section{border-top:1px solid var(--line);padding:12px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:800px){.grid{grid-template-columns:1fr}}
pre{white-space:pre-wrap;word-break:break-word;background:var(--card);padding:8px;border-radius:6px;font-size:13px;max-height:420px;overflow:auto}
.ws{color:#c33;opacity:.6}blockquote.vq{margin:8px 0;padding:6px 12px;border-left:3px solid #c80;background:var(--card)}
.ref{color:var(--mut);font-size:12px}.lbl{font-weight:600;color:#c80}h3 small{color:var(--mut);font-weight:400}
</style></head><body><h1>Text cleanup review</h1><p>%d entries: for every author the messiest entry (by number of logged fixes), a typical one, and one with an extracted verse quote. Bold = pratīka markers.</p>%s</body></html>""" % (len(pick), "\n".join(rows))
    open(os.path.join(ROOT, "scripts", "out", "review", "index.html"), "w").write(page)


if __name__ == "__main__":
    main()
