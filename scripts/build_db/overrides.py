"""Manual decisions for the sloka build, each with a reason.

TEXT_OVERRIDES[verse_id][context_or_current_substring] = (decision, reason)
    decision: "keep" | "besant" | <replacement string>
SPEAKER_POSITION[verse_id] = pada index before which the speaker label is spoken
    (0 = before the verse; 1.21 and 1.28 have the label mid-verse).
STRUCTURE_OVERRIDES[(ch, v)] = {"halves": [...], "split": {half_idx: syllable}, "meter": ...}
"""

TEXT_OVERRIDES = {
    # current is correct, Besant has a typo (DCS unavailable / not aligned here)
    "2.3": {"ब": ("keep", "क्लैब्यं is the standard reading; Besant क्लैव्यं is a typo"),
            "ठ": ("keep", "उत्तिष्ठ is correct; Besant उत्तिष्ट is a typo")},
    "2.9": {"+ः": ("keep", "vocative परन्तप (Gita Press, DCS); Besant परन्तपः")},
    "12.18": {"ा": ("keep", "मानापमानयोः is correct; Besant मानपमानयोः is a typo")},
    # editorial variants: current (popular / Gita Press) reading kept, critical-edition reading noted
    "2.26": {"व": ("keep", "variant: नैवं (Gita Press, current) vs नैनं (Besant, DCS/critical ed.)")},
    "18.68": {"म": ("keep", "variant: य इमं (Gita Press, current) vs य इदं (Besant, DCS/critical ed.)")},
    "3.8": {"द्": ("keep", "orthographic variant प्रसिद्ध्येत् (current, Gita Press) vs प्रसिध्येत्")},
    "17.23": {"+ओं": ("ॐ ", "ॐ dropped from current text (Besant ओं, DCS oṃ); written ॐ as in Gita Press")},
    # current is truncated
    "17.25": {"+भिः": ("besant", "current text truncated: मोक्षकाङ्क्षि -> मोक्षकाङ्क्षिभिः (Besant; DCS mokṣakāṅkṣibhiḥ)")},
}

SPEAKER_POSITION = {
    # Sanjaya narrates the first half, then Arjuna speaks (Besant, Gita Press)
    "1.21": 2,
    "1.28": 2,
}

STRUCTURE_OVERRIDES = {}
