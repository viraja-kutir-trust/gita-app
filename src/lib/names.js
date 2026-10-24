// Display names. The database keeps the source spellings; the UI shows
// standard romanisation so names are consistent everywhere.

export const CHAPTERS = [
  null,
  { sa: "अर्जुनविषादयोगः", ordinal: "प्रथमोऽध्यायः", name: "Arjuna Viṣāda Yoga", en: "Arjuna's Dejection" },
  { sa: "साङ्ख्ययोगः", ordinal: "द्वितीयोऽध्यायः", name: "Sāṅkhya Yoga", en: "The Yoga of Knowledge" },
  { sa: "कर्मयोगः", ordinal: "तृतीयोऽध्यायः", name: "Karma Yoga", en: "The Yoga of Action" },
  { sa: "ज्ञानकर्मसंन्यासयोगः", ordinal: "चतुर्थोऽध्यायः", name: "Jñāna Karma Sannyāsa Yoga", en: "Knowledge and the Renunciation of Action" },
  { sa: "कर्मसंन्यासयोगः", ordinal: "पञ्चमोऽध्यायः", name: "Karma Sannyāsa Yoga", en: "The Yoga of Renunciation" },
  { sa: "आत्मसंयमयोगः", ordinal: "षष्ठोऽध्यायः", name: "Dhyāna Yoga", en: "The Yoga of Meditation" },
  { sa: "ज्ञानविज्ञानयोगः", ordinal: "सप्तमोऽध्यायः", name: "Jñāna Vijñāna Yoga", en: "Knowledge and Realisation" },
  { sa: "अक्षरब्रह्मयोगः", ordinal: "अष्टमोऽध्यायः", name: "Akṣara Brahma Yoga", en: "The Imperishable Brahman" },
  { sa: "राजविद्याराजगुह्ययोगः", ordinal: "नवमोऽध्यायः", name: "Rāja Vidyā Rāja Guhya Yoga", en: "The Royal Knowledge and Royal Secret" },
  { sa: "विभूतियोगः", ordinal: "दशमोऽध्यायः", name: "Vibhūti Yoga", en: "The Divine Glories" },
  { sa: "विश्वरूपदर्शनयोगः", ordinal: "एकादशोऽध्यायः", name: "Viśvarūpa Darśana Yoga", en: "The Vision of the Cosmic Form" },
  { sa: "भक्तियोगः", ordinal: "द्वादशोऽध्यायः", name: "Bhakti Yoga", en: "The Yoga of Devotion" },
  { sa: "क्षेत्रक्षेत्रज्ञविभागयोगः", ordinal: "त्रयोदशोऽध्यायः", name: "Kṣetra Kṣetrajña Vibhāga Yoga", en: "The Field and its Knower" },
  { sa: "गुणत्रयविभागयोगः", ordinal: "चतुर्दशोऽध्यायः", name: "Guṇatraya Vibhāga Yoga", en: "The Three Guṇas" },
  { sa: "पुरुषोत्तमयोगः", ordinal: "पञ्चदशोऽध्यायः", name: "Puruṣottama Yoga", en: "The Supreme Person" },
  { sa: "दैवासुरसम्पद्विभागयोगः", ordinal: "षोडशोऽध्यायः", name: "Daivāsura Sampad Vibhāga Yoga", en: "The Divine and the Demonic" },
  { sa: "श्रद्धात्रयविभागयोगः", ordinal: "सप्तदशोऽध्यायः", name: "Śraddhātraya Vibhāga Yoga", en: "The Threefold Faith" },
  { sa: "मोक्षसंन्यासयोगः", ordinal: "अष्टादशोऽध्यायः", name: "Mokṣa Sannyāsa Yoga", en: "Liberation through Renunciation" },
];

export const VERSE_COUNTS = [0, 47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78];
export const TOTAL_VERSES = 701;

/** 1-based position of a verse in the whole book (2.1 → 48). */
export function bookIndex(chapter, verse) {
  let n = 0;
  for (let c = 1; c < chapter; c++) n += VERSE_COUNTS[c];
  return n + verse;
}

export function fromBookIndex(i) {
  let c = 1;
  while (c < 18 && i > VERSE_COUNTS[c]) {
    i -= VERSE_COUNTS[c];
    c++;
  }
  return { chapter: c, verse: Math.max(1, Math.min(i, VERSE_COUNTS[c])) };
}

export function nextVerse(chapter, verse) {
  if (verse < VERSE_COUNTS[chapter]) return { chapter, verse: verse + 1 };
  if (chapter < 18) return { chapter: chapter + 1, verse: 1 };
  return null;
}

export function prevVerse(chapter, verse) {
  if (verse > 1) return { chapter, verse: verse - 1 };
  if (chapter > 1) return { chapter: chapter - 1, verse: VERSE_COUNTS[chapter - 1] };
  return null;
}

export const verseKey = (chapter, verse) => `${chapter}.${verse}`;

export function parseVerseKey(key) {
  const [c, v] = String(key).split(/[.:]/).map(Number);
  return { chapter: c, verse: v };
}

// author id → display info. `school` buckets drive the commentary filter.
export const AUTHORS = {
  1: { name: "Swami Ramsukhdas", school: "Modern" },
  2: { name: "Swami Chinmayananda", school: "Modern" },
  3: { name: "Ānandagiri", school: "Advaita" },
  4: { name: "Dhanapati", school: "Advaita" },
  5: { name: "Madhvācārya", school: "Dvaita" },
  6: { name: "Nīlakaṇṭha", school: "Advaita" },
  7: { name: "Rāmānujācārya", school: "Viśiṣṭādvaita" },
  8: { name: "Śrīdhara Svāmī", school: "Advaita" },
  9: { name: "Vedānta Deśika", school: "Viśiṣṭādvaita" },
  10: { name: "Abhinavagupta", school: "Other" },
  11: { name: "Jayatīrtha", school: "Dvaita" },
  12: { name: "Madhusūdana Sarasvatī", school: "Advaita" },
  13: { name: "Puruṣottamajī", school: "Other" },
  14: { name: "Śaṅkarācārya", school: "Advaita" },
  15: { name: "Vallabhācārya", school: "Other" },
  16: { name: "Swami Sivananda", school: "Modern" },
  17: { name: "Swami Tejomayananda", school: "Modern" },
  18: { name: "Swami Adidevananda", school: "Viśiṣṭādvaita" },
  19: { name: "Swami Gambhirananda", school: "Advaita" },
  20: { name: "Dr. S. Sankaranarayan", school: "Other" },
  21: { name: "Shri Purohit Swami", school: "Modern" },
  22: { name: "Swami Nirvikalpananda", school: "Modern" },
  23: { name: "Annie Besant", school: "Modern" },
  24: { name: "Andhra Bhagavadgita (1911)", school: "Modern" },
  25: { name: "Subramania Bharathi", school: "Modern" },
  26: { name: "Swami Swarupananda (1909)", school: "Advaita" },
  27: { name: "A. Mahadeva Sastri (1901)", commentaryName: "Śaṅkarācārya · English (A. Mahadeva Sastri)", school: "Advaita" },
};

export const SCHOOLS = ["All", "Advaita", "Viśiṣṭādvaita", "Dvaita", "Other", "Modern"];

export function authorName(id, fallback, type) {
  const a = AUTHORS[id];
  if (type === "commentary" && a?.commentaryName) return a.commentaryName;
  return a?.name || fallback || `Author ${id}`;
}

export function authorSchool(id) {
  return AUTHORS[id]?.school || "Other";
}

export const LANGS = {
  sanskrit: { label: "Sanskrit", native: "संस्कृतम्" },
  hindi: { label: "Hindi", native: "हिन्दी" },
  english: { label: "English", native: "English" },
  telugu: { label: "Telugu", native: "తెలుగు" },
  tamil: { label: "Tamil", native: "தமிழ்" },
};

export const langLabel = (l) => LANGS[l]?.label || l;
export const langNative = (l) => LANGS[l]?.native || l;

/** Rough reading time in minutes for a text, at a learner's pace. */
export function readingMinutes(wordCount, lang) {
  const wpm = lang === "sanskrit" ? 70 : lang === "english" ? 200 : 150;
  return Math.max(1, Math.round((wordCount || 0) / wpm));
}

/** Where the word-by-word glosses come from (via the gita/gita dataset). */
export const WORD_MEANING_SOURCE = "Swami Mukundananda";
export const WORD_MEANING_CREDIT = "Word meanings: Swami Mukundananda, “Bhagavad Gita – The Song of God” (holy-bhagavad-gita.org), via the gita/gita dataset";
