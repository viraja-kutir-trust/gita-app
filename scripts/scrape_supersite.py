#!/usr/bin/env python3
"""
Polite collector for Gita Supersite (IIT Kanpur) content for the offline
Bhagavad Gita app.

The Supersite now lives in two places:

  * old.gitasupersite.in      - the preserved original Drupal portal
                                 (/srimad?language=..&field_chapter_value=..&field_nsutra_value=..)
                                 robots.txt: "User-agent: * / Crawl-delay: 10"
  * heritage.iitk.ac.in        - the successor platform (Heritage Scripture Server)
                                 with an official JSON API at /api/v1/ that needs
                                 "Authorization: Api-Key <key>" (request one at
                                 https://heritage.iitk.ac.in/api-access).

LICENSING - READ BEFORE RUNNING
  Content is governed by the Heritage Content Access Licence (HCAL-1.1,
  https://heritage.iitk.ac.in/api/v1/license/):
    Tier A  moolam + transliterations ........ public domain, any use
    Tier B  Sanskrit bhashyas, AI/community .. non-commercial, attribution required
    Tier C  named-scholar modern translations,
            modern-language commentaries,
            commentary translations .......... platform reading ONLY. Scraping or
                                                any automated harvesting is prohibited
                                                (HCAL Art. 4a).
  This script therefore ONLY collects Tier A and Tier B content. Tier C portal
  fields (htrskd, etsiva, etgb, hcchi, setgb, ...) are hard-blocked below.

Sources
  --source portal   no key needed. One request per verse per script.
                    Devanagari page optionally also carries every Sanskrit
                    bhashya (--sa-commentaries) and the audio <source> tags,
                    so one request per verse gets everything.
  --source api      needs HSS_API_KEY env var. Uses the official endpoints.
                    Free tier quota is small (docs example: 50 units/day);
                    the script stops cleanly when quota runs out and resumes
                    next run from cache.

Examples
  # test set
  python3 scripts/scrape_supersite.py --verses 1.1-3,2.47,18.78 --sa-commentaries --scripts dv,ro
  # full portal run (Devanagari + Sanskrit bhashyas + audio URLs), ~2h at Crawl-delay 10
  python3 scripts/scrape_supersite.py --all --sa-commentaries
  # rebuild JSON from cache only, no network
  python3 scripts/scrape_supersite.py --all --offline

Stdlib only (urllib); no third-party packages required.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE_ROOT = HERE / ".cache" / "supersite"
OUT_ROOT = HERE / "out" / "supersite"

PORTAL_BASE = "https://old.gitasupersite.in"
API_BASE = "https://heritage.iitk.ac.in/api/v1"
PORTAL_CRAWL_DELAY = 10.0  # from old.gitasupersite.in/robots.txt

# Verses per chapter, matching src/gita-data/verse.json (701 incl. 13.1 "Arjuna uvaca" verse).
CHAPTER_VERSES = [47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78]

# Scripts offered by the portal's `language` select.
PORTAL_SCRIPTS = {
    "dv": "devanagari", "ro": "roman_iast", "as": "assamese", "bn": "bengali",
    "gu": "gujarati", "pa": "gurmukhi", "kn": "kannada", "ml": "malayalam",
    "or": "odia", "ta": "tamil", "te": "telugu",
}

# Tier B (open classical) Sanskrit bhashyas on the portal: param -> (author, author_id in our authors.json)
PORTAL_SA_COMMENTARIES = {
    "scsh":    ("Sri Shankaracharya", 14),
    "scang":   ("Sri Abhinavgupta", 10),
    "scram":   ("Sri Ramanujacharya", 7),
    "scanand": ("Sri Anandgiri", 3),
    "scjaya":  ("Sri Jayatritha", 11),
    "scmad":   ("Sri Madhavacharya", 5),
    "scval":   ("Sri Vallabhacharya", 15),
    "scms":    ("Sri Madhusudan Saraswati", 12),
    "scsri":   ("Sri Sridhara Swami", 8),
    "scvv":    ("Sri Vedantadeshikacharya Venkatanatha", 9),
    "scpur":   ("Sri Purushottamji", 13),
    "scneel":  ("Sri Neelkanth", 6),
    "scdhan":  ("Sri Dhanpati", 4),
}

# Tier C on the portal: copyrighted modern works. Never requested by this script.
PORTAL_TIER_C_BLOCKED = {
    "htrskd", "httyn", "htshg", "hcchi", "hcrskd", "ecsiva", "etsiva",
    "etpurohit", "etgb", "setgb", "etssa", "etassa", "etradi", "etadi",
}

# Audio checkboxes: they only add <audio> tags (URLs); we never download the MP3s.
PORTAL_AUDIO_PARAMS = {"show_mool": "1", "show_purohit": "1", "show_tej": "1"}
AUDIO_TRACKS = {
    "slkaudio":     {"track": "sanskrit_recitation", "reciter": "Swami Brahmananda", "lang": "sanskrit"},
    "purohitAudio": {"track": "english_translation_purohit", "reciter": "T. Archna", "lang": "english"},
    "tejAudio":     {"track": "hindi_translation_tejomayananda", "reciter": "T. Archna", "lang": "hindi"},
}

ATTRIBUTION = {
    "source": "Gita Supersite, IIT Kanpur (old.gitasupersite.in / heritage.iitk.ac.in)",
    "licence": "HCAL-1.1 https://heritage.iitk.ac.in/api/v1/license/",
    "statement": "Accessed via Heritage Scripture Server (heritage.iitk.ac.in).",
    "tiers": "Tier A (moolam, transliteration): public domain. Tier B (Sanskrit bhashyas): "
             "non-commercial use with attribution only.",
}


# ----------------------------------------------------------------------------- HTTP

class Fetcher:
    def __init__(self, delay: float, user_agent: str, retries: int, offline: bool,
                 extra_headers: dict | None = None):
        self.delay = delay
        self.ua = user_agent
        self.retries = retries
        self.offline = offline
        self.extra_headers = extra_headers or {}
        self._last = 0.0
        self.network_requests = 0
        self.cache_hits = 0

    def _sleep(self):
        wait = self.delay - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)

    def get(self, url: str, cache_path: Path) -> str | None:
        if cache_path.exists():
            self.cache_hits += 1
            return cache_path.read_text(encoding="utf-8")
        if self.offline:
            return None
        headers = {"User-Agent": self.ua, "Accept-Language": "en", **self.extra_headers}
        for attempt in range(self.retries + 1):
            self._sleep()
            self._last = time.monotonic()
            self.network_requests += 1
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=60) as r:
                    body = r.read().decode("utf-8", errors="replace")
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                tmp = cache_path.with_suffix(cache_path.suffix + ".part")
                tmp.write_text(body, encoding="utf-8")
                tmp.replace(cache_path)
                return body
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    log(f"  404 {url}")
                    return None
                if e.code in (401, 403):
                    raise SystemExit(f"HTTP {e.code} for {url} - check API key / access. Stopping.")
                retry_after = e.headers.get("Retry-After") if e.headers else None
                wait = float(retry_after) if retry_after and retry_after.isdigit() else backoff(attempt)
                log(f"  HTTP {e.code} (attempt {attempt + 1}/{self.retries + 1}), waiting {wait:.0f}s")
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                wait = backoff(attempt)
                log(f"  {type(e).__name__}: {e} (attempt {attempt + 1}/{self.retries + 1}), waiting {wait:.0f}s")
            if attempt < self.retries:
                time.sleep(wait)
        log(f"  giving up on {url}")
        return None


def backoff(attempt: int) -> float:
    return min(300.0, 5.0 * (2 ** attempt)) + random.uniform(0, 2)


def log(msg: str):
    print(msg, file=sys.stderr, flush=True)


# ----------------------------------------------------------------------------- parsing (portal)

BR_RE = re.compile(r"<br\s*/?>", re.I)
TAG_RE = re.compile(r"<[^>]+>")
DANDA = "[।|.৷॥]"
# trailing "।।2.47।।" (site sometimes has a single danda, e.g. "।।18.78।"; Roman uses "৷৷2.47৷৷")
VERSE_NO_RE = re.compile(rf"\s*{DANDA}{{1,2}}\s*(\d+)\s*\.\s*(\d+)\s*{DANDA}{{0,2}}\s*$")
LEADING_VERSE_NO_RE = re.compile(rf"^\s*{DANDA}{{1,2}}\s*\d+\s*\.\s*\d+\s*{DANDA}{{1,2}}\s*")
SPEAKER_RE = re.compile(r"^\S+(?:\s+\S+)?\s+(?:उवाच|uvāca|uvaca)$")


def clean_text(fragment: str) -> list[str]:
    """HTML fragment -> list of text lines (blank lines collapsed, original line breaks kept)."""
    frag = BR_RE.sub("\n", fragment)
    frag = re.sub(r"</p\s*>", "\n", frag, flags=re.I)
    text = html.unescape(TAG_RE.sub("", frag)).replace("﻿", "").replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.split("\n")]
    return [ln for ln in lines if ln]


def field_blocks(page: str) -> dict[str, str]:
    """Split the views output into {field_name: inner_html}. The portal emits
    malformed tags like `<div class="views-field views-field-field-scang"   <p ...`
    (missing '>') so we split by regex rather than with an HTML parser."""
    start = page.find('class="view-content"')
    end = page.find("function playAudio")
    region = page[start:end if end > 0 else None] if start >= 0 else ""
    parts = re.split(r'<div class="views-field views-field-([a-z0-9_-]+)"', region)
    out = {}
    for i in range(1, len(parts) - 1, 2):
        name = parts[i].replace("field-", "", 1) if parts[i].startswith("field-") else parts[i]
        out[name] = parts[i + 1]
    return out


def strip_heading(block: str) -> str:
    """Drop the centred blue heading paragraph ("मूल श्लोकः" / "Sanskrit Commentary By ...")."""
    return re.sub(r"<p[^>]*>\s*<font[^>]*color\s*=\s*['\"]#2c44bd['\"][^>]*>.*?</font>\s*</p>", "",
                  block, count=1, flags=re.S | re.I)


def parse_moolam(block: str):
    lines = clean_text(strip_heading(block))
    verse_ref = None
    if lines:
        m = VERSE_NO_RE.search(lines[-1])
        if m:
            verse_ref = f"{m.group(1)}.{m.group(2)}"
            lines[-1] = lines[-1][: m.start()].rstrip()
            if not lines[-1]:
                lines.pop()
    speaker = None
    if len(lines) > 1 and SPEAKER_RE.match(lines[0]):
        speaker = lines.pop(0)
    return lines, verse_ref, speaker


def script_entry(lines, speaker):
    e = {"lines": lines, "text": "\n".join(lines)}
    if speaker:
        e["speaker"] = speaker
    return e


def parse_audio(page: str) -> list[dict]:
    out = []
    for m in re.finditer(r"<audio id\s*=\s*'([^']+)'.*?<source src\s*=\s*'([^']+)'", page, re.S):
        aid, src = m.group(1), m.group(2)
        url = urllib.parse.urljoin(PORTAL_BASE + "/", src.lstrip("./"))
        out.append({**AUDIO_TRACKS.get(aid, {"track": aid}), "url": url})
    return out


# ----------------------------------------------------------------------------- verse selection

def all_verses():
    for c, n in enumerate(CHAPTER_VERSES, 1):
        for v in range(1, n + 1):
            yield c, v


def parse_verse_spec(spec: str):
    """'1.1-3,2.47,18' -> [(1,1),(1,2),(1,3),(2,47),(18,1..78)]"""
    out = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "." not in part:
            c = int(part)
            out += [(c, v) for v in range(1, CHAPTER_VERSES[c - 1] + 1)]
            continue
        c, vs = part.split(".", 1)
        c = int(c)
        if "-" in vs:
            a, b = map(int, vs.split("-"))
            out += [(c, v) for v in range(a, b + 1)]
        else:
            out.append((c, int(vs)))
    for c, v in out:
        if not (1 <= c <= 18 and 1 <= v <= CHAPTER_VERSES[c - 1]):
            raise SystemExit(f"verse {c}.{v} out of range")
    return out


# ----------------------------------------------------------------------------- portal source

def portal_url(c: int, v: int, script: str, sa_comm: bool) -> str:
    params = {"language": script, "field_chapter_value": c, "field_nsutra_value": v}
    if script == "dv":
        params.update(PORTAL_AUDIO_PARAMS)
        if sa_comm:
            params.update({k: 1 for k in PORTAL_SA_COMMENTARIES})
            params["choose"] = 1
    assert not (set(params) & PORTAL_TIER_C_BLOCKED), "Tier C field requested - refusing"
    return f"{PORTAL_BASE}/srimad?{urllib.parse.urlencode(params)}"


def run_portal(args, verses, fetcher: Fetcher):
    verses_out, comm_out, audio_out, problems = {}, [], [], []
    scripts = args.scripts
    total = len(verses) * len(scripts)
    done = 0
    for c, v in verses:
        key = f"{c}.{v}"
        rec = verses_out.setdefault(key, {"chapter": c, "verse": v, "ref": key, "scripts": {}})
        for script in scripts:
            done += 1
            variant = "sa" if (script == "dv" and args.sa_commentaries) else "base"
            cache = CACHE_ROOT / "portal" / script / variant / f"{c:02d}-{v:03d}.html"
            url = portal_url(c, v, script, args.sa_commentaries)
            log(f"[{done}/{total}] {key} {script}{' +sa' if variant == 'sa' else ''}"
                f"{' (cache)' if cache.exists() else ''}")
            page = fetcher.get(url, cache)
            if page is None:
                problems.append(f"{key} {script}: not fetched")
                continue
            blocks = field_blocks(page)
            if "body" not in blocks:
                problems.append(f"{key} {script}: no moolam block")
                continue
            lines, ref, speaker = parse_moolam(blocks["body"])
            if ref and ref != key:
                problems.append(f"{key} {script}: page verse marker says {ref}")
            rec["scripts"][PORTAL_SCRIPTS[script]] = script_entry(lines, speaker)
            if script == "dv":
                rec["sanskrit"] = script_entry(lines, speaker)
                for a in parse_audio(page):
                    audio_out.append({"ref": key, "chapter": c, "verse": v, **a})
                if args.sa_commentaries:
                    for param, (author, author_id) in PORTAL_SA_COMMENTARIES.items():
                        b = blocks.get(param)
                        if not b:
                            continue
                        clines = clean_text(strip_heading(b))
                        if clines:
                            clines[0] = LEADING_VERSE_NO_RE.sub("", clines[0])
                            clines = [ln for ln in clines if ln]
                        if not clines:
                            continue
                        comm_out.append({
                            "ref": key, "chapter": c, "verse": v, "author": author,
                            "author_id": author_id, "portal_field": param, "lang": "sanskrit",
                            "tier": "B", "text": "\n".join(clines),
                        })
            if script == "ro":
                rec["transliteration_iast"] = script_entry(lines, speaker)
    return verses_out, comm_out, audio_out, problems


# ----------------------------------------------------------------------------- api source

def run_api(args, verses, fetcher: Fetcher):
    """Official HSS API. Only Tier A/B is returned by design (Tier C -> 404)."""
    verses_out, comm_out, trans_out, problems = {}, [], [], []
    endpoints = ["moolam/", "transliterations/"]
    if args.sa_commentaries:
        endpoints.append("commentaries/sa/")
    if args.api_translations:
        endpoints.append("translations/")
    for i, (c, v) in enumerate(verses, 1):
        key = f"{c}.{v}"
        rec = verses_out.setdefault(key, {"chapter": c, "verse": v, "ref": key})
        for ep in endpoints:
            cache = CACHE_ROOT / "api" / ep.strip("/").replace("/", "_") / f"{c:02d}-{v:03d}.json"
            log(f"[{i}/{len(verses)}] {key} {ep}{' (cache)' if cache.exists() else ''}")
            body = fetcher.get(f"{API_BASE}/SBG/{c}/{v}/{ep}", cache)
            if body is None:
                problems.append(f"{key} {ep}: not fetched")
                continue
            data = json.loads(body)
            quota = (data.get("_meta") or {}).get("quota") or {}
            if quota.get("units_remaining") is not None and quota["units_remaining"] <= args.api_reserve:
                log(f"API quota nearly exhausted ({quota}); stopping. Re-run later to resume.")
                return verses_out, comm_out, trans_out, problems + ["stopped: quota"]
            if ep == "moolam/":
                text = data.get("text", "")
                lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
                rec["sanskrit"] = {"lines": lines, "text": "\n".join(lines)}
                rec["api_moolam_raw"] = data
            elif ep == "transliterations/":
                rec["api_transliterations_raw"] = data
            elif ep == "commentaries/sa/":
                for item in data.get("results", []):
                    comm_out.append({"ref": key, "chapter": c, "verse": v,
                                     "author": (item.get("author") or {}).get("name"),
                                     "slug": item.get("slug"), "lang": "sanskrit", "tier": "B",
                                     "source_type": item.get("source_type"), "text": item.get("text")})
            elif ep == "translations/":
                for item in data.get("results", []):
                    if item.get("source_type") == "authoritative":
                        continue  # defensive: Tier C must never be stored
                    trans_out.append({"ref": key, "chapter": c, "verse": v,
                                      "author": (item.get("author") or {}).get("name"),
                                      "label": item.get("label"), "slug": item.get("slug"),
                                      "lang": item.get("language") or item.get("lang"),
                                      "source_type": item.get("source_type"), "tier": "B",
                                      "text": item.get("text")})
    return verses_out, comm_out, trans_out, problems


# ----------------------------------------------------------------------------- main

def write_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sel = ap.add_mutually_exclusive_group(required=True)
    sel.add_argument("--all", action="store_true", help="all 701 verses")
    sel.add_argument("--verses", help="e.g. '1.1-3,2.47,18.78' or '18' for a whole chapter")
    ap.add_argument("--source", choices=["portal", "api"], default="portal")
    ap.add_argument("--scripts", default="dv",
                    help=f"portal scripts, comma list from {','.join(PORTAL_SCRIPTS)} or 'all' (default dv)")
    ap.add_argument("--sa-commentaries", action="store_true",
                    help="also collect the Tier B Sanskrit bhashyas (non-commercial + attribution)")
    ap.add_argument("--api-translations", action="store_true",
                    help="api source: also collect API-exposed (AI/community, Tier B) translations")
    ap.add_argument("--api-reserve", type=int, default=2, help="stop when API units_remaining <= this")
    ap.add_argument("--delay", type=float, default=None,
                    help=f"seconds between requests (min 1; default {PORTAL_CRAWL_DELAY:g} portal per robots.txt, 1 api)")
    ap.add_argument("--retries", type=int, default=4)
    ap.add_argument("--contact", default=os.environ.get("SCRAPER_CONTACT", ""),
                    help="contact URL/email appended to the User-Agent (env SCRAPER_CONTACT)")
    ap.add_argument("--offline", action="store_true", help="build outputs from cache only")
    ap.add_argument("--out", default=str(OUT_ROOT))
    args = ap.parse_args()

    args.scripts = list(PORTAL_SCRIPTS) if args.scripts == "all" else [s.strip() for s in args.scripts.split(",")]
    bad = [s for s in args.scripts if s not in PORTAL_SCRIPTS]
    if bad:
        raise SystemExit(f"unknown scripts {bad}")
    default_delay = PORTAL_CRAWL_DELAY if args.source == "portal" else 1.0
    delay = max(1.0, args.delay if args.delay is not None else default_delay)
    if args.source == "portal" and delay < PORTAL_CRAWL_DELAY:
        log(f"WARNING: delay {delay}s is below the portal's robots.txt Crawl-delay of {PORTAL_CRAWL_DELAY:g}s")

    ua = "BhagavadGitaOfflineApp-DataSync/1.0 (non-commercial offline Gita reader app)"
    # NB: the portal's firewall drops connections whose UA contains "python-urllib".
    if args.contact:
        ua = ua[:-1] + f"; +{args.contact})"
    headers = {}
    if args.source == "api":
        key = os.environ.get("HSS_API_KEY")
        if not key and not args.offline:
            raise SystemExit("set HSS_API_KEY (request one at https://heritage.iitk.ac.in/api-access)")
        if key:
            headers["Authorization"] = f"Api-Key {key}"
            headers["Accept"] = "application/json"

    verses = list(all_verses()) if args.all else parse_verse_spec(args.verses)
    fetcher = Fetcher(delay, ua, args.retries, args.offline, headers)
    t0 = time.time()
    out = Path(args.out)

    if args.source == "portal":
        verses_out, comm, audio, problems = run_portal(args, verses, fetcher)
        write_json(out / "audio.json", audio)
        extra = {"audio_entries": len(audio)}
    else:
        verses_out, comm, trans, problems = run_api(args, verses, fetcher)
        write_json(out / "api_translations_tier_b.json", trans)
        extra = {"translations": len(trans)}

    prefix = "" if args.source == "portal" else "api_"
    write_json(out / f"{prefix}verses.json", sorted(verses_out.values(), key=lambda r: (r["chapter"], r["verse"])))
    write_json(out / f"{prefix}commentaries_sanskrit.json", comm)
    manifest = {
        "source": args.source, "attribution": ATTRIBUTION, "verses": len(verses_out),
        "commentaries": len(comm), **extra, "scripts": args.scripts if args.source == "portal" else None,
        "network_requests": fetcher.network_requests, "cache_hits": fetcher.cache_hits,
        "elapsed_s": round(time.time() - t0, 1), "problems": problems,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    write_json(out / f"{prefix}manifest.json", manifest)
    log(json.dumps({k: v for k, v in manifest.items() if k != "attribution"}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
