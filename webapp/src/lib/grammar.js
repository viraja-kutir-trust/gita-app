// Grammar labels for the word panel (same wording as the phone app's word sheet).

// "noun · locative · plural · neuter" → labelled facts a learner can read.
const CASE_HINT = {
  nominative: "subject",
  accusative: "object · “to”",
  instrumental: "“by, with”",
  dative: "“for”",
  ablative: "“from”",
  genitive: "“of”",
  locative: "“in, on”",
  vocative: "addressing",
};

// The traditional Sanskrit name for each grammatical term (Devanagari; shown in the reader's script).
// Terms with no settled traditional equivalent (e.g. "indicative", "past") are left without one.
const SANSKRIT_TERM = {
  noun: "नाम",
  verb: "क्रियापदम्",
  adjective: "विशेषणम्",
  pronoun: "सर्वनाम",
  adverb: "क्रियाविशेषणम्",
  particle: "निपातः",
  conjunction: "अव्ययम्",
  "subordinating conjunction": "अव्ययम्",
  interjection: "निपातः",
  adposition: "कर्मप्रवचनीयः",
  numeral: "सङ्ख्या",
  nominative: "प्रथमा विभक्तिः",
  accusative: "द्वितीया विभक्तिः",
  instrumental: "तृतीया विभक्तिः",
  dative: "चतुर्थी विभक्तिः",
  ablative: "पञ्चमी विभक्तिः",
  genitive: "षष्ठी विभक्तिः",
  locative: "सप्तमी विभक्तिः",
  vocative: "सम्बोधनम्",
  singular: "एकवचनम्",
  dual: "द्विवचनम्",
  plural: "बहुवचनम्",
  masculine: "पुंलिङ्गम्",
  feminine: "स्त्रीलिङ्गम्",
  neuter: "नपुंसकलिङ्गम्",
  "3rd person": "प्रथमपुरुषः",
  "2nd person": "मध्यमपुरुषः",
  "1st person": "उत्तमपुरुषः",
  present: "लट्",
  imperfect: "लङ्",
  future: "लृट्",
  "s-aorist": "लुङ्",
  imperative: "लोट्",
  optative: "विधिलिङ्",
  conditional: "लृङ्",
  passive: "कर्मणि प्रयोगः",
  participle: "कृदन्तम्",
  "absolutive (gerund)": "क्त्वान्तम् / ल्यबन्तम्",
  infinitive: "तुमुन्नन्तम्",
  gerundive: "कृत्यप्रत्ययान्तम्",
  "compound member": "समासपदम्",
};

export function describe(morph) {
  if (!morph) return [];
  const parts = morph.split(" · ");
  const out = [];
  const cap = (p) => p.charAt(0).toUpperCase() + p.slice(1);
  const fact = (k, v, p) => out.push({ k, v, sa: SANSKRIT_TERM[p] });
  const pos = parts.shift();
  if (pos) fact("Part of speech", cap(pos), pos);
  for (const p of parts) {
    if (CASE_HINT[p]) fact("Case", `${cap(p)} · ${CASE_HINT[p]}`, p);
    else if (["singular", "dual", "plural"].includes(p)) fact("Number", cap(p), p);
    else if (["masculine", "feminine", "neuter"].includes(p)) fact("Gender", cap(p), p);
    else if (/person/.test(p)) fact("Person", p, p);
    else if (/present|past|future|perfect|aorist|imperfect/.test(p)) fact("Tense", p, p);
    else if (/imperative|optative|injunctive|indicative|conditional/.test(p)) fact("Mood", p, p);
    else fact("Form", p, p);
  }
  return out;
}

/** Several word-by-word entries shown as one: terms side by side, meanings in order, all their grammar. */
export function combineEntries(list) {
  const join = (f, sep) => list.map((e) => e[f]).filter(Boolean).join(sep);
  return {
    termDev: join("termDev", " "),
    termTe: join("termTe", " "),
    termIast: join("termIast", " "),
    meaning: join("meaning", "; "),
    dcsIdx: list.flatMap((e) => e.dcsIdx || []),
  };
}
