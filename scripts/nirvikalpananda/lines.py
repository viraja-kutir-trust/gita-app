"""Group the glyph spans of a page into lines and decode them.

A line is the spans sharing a baseline, in x order. Footnote markers are small
digits raised above a line; they are attached to that line at their x position and
come out of `Line.text()` as ⁽n⁾ right after the word they follow.
"""
import json
import os
import re

from anu import VATTU, decode
from anu_glyphs import PREFIX, is_mark

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(ROOT, "scripts", "out", "nirvikalpananda", "_cache")
SKIP = ("Ding", "Zapf")


def load_pages(ch):
    return json.load(open(os.path.join(CACHE, "spans", f"ch{ch:02d}.json")))


def is_anu(font):
    return not font.startswith(("Times", "TeluguNumbers"))


class Run:
    """Consecutive glyphs of one font family on a line (a word may span several)."""

    def __init__(self, font, size, glyphs):
        self.font, self.size, self.glyphs = font, size, glyphs  # glyphs: [(char, x0)]

    @property
    def raw(self):
        return "".join(c for c, _ in self.glyphs)

    @property
    def x(self):
        """x of the first visible glyph."""
        for c, x in self.glyphs:
            if c.strip():
                return x
        return self.glyphs[0][1]

    @property
    def bold(self):
        return "Bold" in self.font


def decode_run(font, raw):
    if font.startswith("TeluguNumbers"):
        return raw.replace("-", "ఽ")  # this font only carries the avagraha
    if not is_anu(font):
        return raw
    return decode(raw)


class Line:
    def __init__(self, oy, spans):
        self.oy = oy
        self.spans = sorted(spans, key=lambda s: s["x0"])
        self.markers = []  # [(x0, "n")]
        self.runs = self._runs()

    def _runs(self):
        runs = []
        for s in self.spans:
            glyphs = list(zip(s["text"], s["cx"]))
            fam = "anu" if is_anu(s["font"]) else s["font"]
            if runs and runs[-1][0] == fam and (fam != "anu" or runs[-1][1].bold == ("Bold" in s["font"]) or s["text"].strip() == ""):
                prev = runs[-1][1]
                if s["x0"] - prev.x1 > 0.25 * s["size"] and not prev.raw.endswith(" ") and not s["text"].startswith(" "):
                    prev.glyphs.append((" ", s["x0"]))
                prev.glyphs.extend(glyphs)
                prev.x1 = s["cx"][-1]
                prev.size = max(prev.size, s["size"])
                continue
            runs.append((fam, Run(s["font"], s["size"], glyphs)))
            runs[-1][1].x1 = s["cx"][-1]
        runs = [r for _, r in runs]
        # A syllable's last mark sometimes lands in the next span (another font):
        # 'K' (bold headword) + '«´ …' (thin meaning). Give it back.
        for a, b in zip(runs, runs[1:]):
            if not (is_anu(a.font) and is_anu(b.font)):
                continue
            k = 0
            while k < len(b.glyphs) and (b.glyphs[k][0] in " \u00a0" or is_mark(b.glyphs[k][0])):
                k += 1
            lead = [g for g in b.glyphs[:k] if is_mark(g[0])]
            if lead:
                a.glyphs.extend(lead)
                b.glyphs = [g for g in b.glyphs[:k] if not is_mark(g[0])] + b.glyphs[k:]
        # …and a run holding only a ra-vattu belongs to the next syllable.
        for a, b in zip(runs, runs[1:]):
            if is_anu(a.font) and is_anu(b.font) and a.raw.strip() and all(c in PREFIX or not c.strip() for c in a.raw):
                b.glyphs = [g for g in a.glyphs if g[0].strip()] + b.glyphs
                a.glyphs = []
        return [r for r in runs if r.glyphs]

    @property
    def x0(self):
        return min(r.x for r in self.runs if r.raw.strip()) if any(r.raw.strip() for r in self.runs) else self.spans[0]["x0"]

    @property
    def fonts(self):
        return {s["font"] for s in self.spans if s["text"].strip()}

    @property
    def size(self):
        sizes = [s["size"] for s in self.spans if s["text"].strip()]
        return max(sizes) if sizes else 0

    def run_text(self, run, markers=None):
        """Decode one run, inserting ⁽n⁾ markers after the word they follow."""
        markers = sorted(markers if markers is not None else [])
        glyphs = run.glyphs
        cuts = []
        for mx, n in markers:
            k = 0
            for i, (c, x) in enumerate(glyphs):
                if c.strip() and x < mx - 0.5:
                    k = i + 1
            # move to the end of the word (next space) so a syllable is never split
            while k < len(glyphs) and glyphs[k][0] not in "  ":
                k += 1
            cuts.append((k, n))
        out, prev = [], 0
        for k, n in cuts:
            out.append(decode_run(run.font, "".join(c for c, _ in glyphs[prev:k])))
            out.append(f"⁽{n}⁾")
            prev = k
        out.append(decode_run(run.font, "".join(c for c, _ in glyphs[prev:])))
        return "".join(out)

    def text(self):
        parts = []
        for i, r in enumerate(self.runs):
            nxt = self.runs[i + 1].x if i + 1 < len(self.runs) else 1e9
            lo = -1e9 if i == 0 else r.x - 1  # a marker may sit just before the line's first word
            ms = [(x, n) for x, n in self.markers if lo <= x < nxt - 0.5]
            parts.append(self.run_text(r, ms))
        t = "".join(parts)
        t = re.sub(r"\s+ఽ", "ఽ", t)
        return t

    def __repr__(self):
        return f"<Line {self.oy:.0f} {self.text()!r}>"


# vattu glyph for each consonant, to re-attach conjunct pieces set as separate boxes
VATTU_GLYPH = {}
for _g, _c in VATTU.items():
    VATTU_GLYPH.setdefault(_c, _g)
VATTU_GLYPH["ష"] = "¬"


def stray_to_vattus(raw):
    """'H∆' (క్ష typed as a separate small box under ఙ) -> '¯¬' (vattu glyphs)."""
    u = decode(raw).strip()
    out = []
    for ch in u:
        if ch == "్":
            continue
        if ch not in VATTU_GLYPH:
            return None
        out.append(VATTU_GLYPH[ch])
    return "".join(out) or None


def page_lines(spans):
    spans = [s for s in spans if not s["font"].startswith(SKIP) and s["text"]]
    # Conjunct pieces the font cannot stack (క్ష under ఙ, ష్ణ under క) are set as tiny
    # separate boxes just below the line; attach them to the glyph above.
    subs = []
    for s in spans:
        t = s["text"].strip()
        if not t or len(t) > 3 or not is_anu(s["font"]) or t.isdigit():
            continue
        host = [h for h in spans if h is not s and h["size"] >= s["size"] + 2 and 2 < s["oy"] - h["oy"] < 10
                and h["x0"] - 2 <= s["x0"] <= h["x1"] + 2]
        if host:
            vg = stray_to_vattus(t)
            if vg:
                subs.append((s, host[0], vg))
    for s, h, vg in subs:
        spans.remove(s)
        # insert after the cluster whose glyph sits just left of the box
        cx = h["cx"]
        j = max([i for i in range(len(h["text"])) if cx[i] <= s["x0"] + 2] or [0])
        k = j + 1
        while k < len(h["text"]) and is_mark(h["text"][k]):
            k += 1
        h["text"] = h["text"][:k] + vg + h["text"][k:]
        h["cx"] = cx[:k] + [cx[k] if k < len(cx) else cx[-1]] * len(vg) + cx[k:]
    body, sups = [], []
    for s in spans:
        if s["text"].strip().strip(".").isdigit() and s["size"] <= 11 and any(
                t is not s and t["size"] >= s["size"] * 1.35 and 1.5 < t["oy"] - s["oy"] < t["size"] * 0.8
                and t["x0"] - 30 < s["x0"] < t["x1"] + 30 for t in spans):
            sups.append(s)
        else:
            body.append(s)
    rows = []
    for s in sorted(body, key=lambda s: (s["oy"], s["x0"])):
        for r in rows:
            if abs(r[0] - s["oy"]) < 2.5:
                r[1].append(s)
                break
        else:
            rows.append([s["oy"], [s]])
    lines = [Line(oy, ss) for oy, ss in sorted(rows, key=lambda r: r[0])]
    for s in sups:
        cands = [l for l in lines if 1.5 < l.oy - s["oy"] < l.size * 0.8 and any(
            sp["x0"] - 30 < s["x0"] < sp["x1"] + 30 for sp in l.spans)]
        if not cands:
            raise ValueError(f"orphan footnote marker {s}")
        line = min(cands, key=lambda l: l.oy - s["oy"])
        for n in s["text"].replace(".", " ").split():
            line.markers.append((s["x0"], n))
    return lines
