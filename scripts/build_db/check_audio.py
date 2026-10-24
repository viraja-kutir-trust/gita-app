"""Task 5: HEAD-check per-verse recitation URLs on jsDelivr (gita/gita repo).

Polite: 5 parallel workers, small delay per request. Results are cached in
scripts/out/build/audio.json; pass --refresh to re-check.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "scripts", "out", "build", "audio.json")
URL = "https://cdn.jsdelivr.net/gh/gita/gita@main/data/verse_recitation/{ch}/{v}.mp3"
UA = "GitaAppDataBuild/1.0 (non-profit educational app; one-off availability check)"


def head(url, tries=3):
    for t in range(tries):
        time.sleep(0.15)
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, int(r.headers.get("Content-Length") or 0), r.headers.get("Content-Type")
        except urllib.error.HTTPError as e:
            if e.code in (404, 403):
                return e.code, 0, None
            err = e.code
        except Exception as e:  # network hiccup
            err = str(e)
        time.sleep(1.5 * (t + 1))
    return err, 0, None


TREE_API = "https://api.github.com/repos/gita/gita/git/trees/main?recursive=1"
RAW = "https://raw.githubusercontent.com/gita/gita/main/data/verse_recitation/{ch}/{v}.mp3"
PREFIX = "data/verse_recitation/"


def github_tree():
    """Authoritative file list + sizes + blob sha in one API call (uses the gh CLI
    if logged in, which avoids the anonymous rate limit)."""
    import shutil
    import subprocess
    if shutil.which("gh"):
        try:
            out = subprocess.run(["gh", "api", TREE_API.replace("https://api.github.com/", "")],
                                 capture_output=True, check=True, timeout=60).stdout
            return json.loads(out)
        except Exception as e:  # fall through to anonymous API
            print("gh api failed:", e)
    req = urllib.request.Request(TREE_API, headers={"User-Agent": UA, "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    refresh = "--refresh" in sys.argv
    cached = json.load(open(OUT)) if os.path.exists(OUT) else None
    if cached and cached.get("tree_sha") and not refresh:
        print("audio: using cached", OUT)
        return
    verses = json.load(open(os.path.join(ROOT, "src", "gita-data", "verse.json")))
    jobs = [(v["id"], v["chapter_number"], v["verse_number"]) for v in verses]
    # numbering spot checks (one past the end of a chapter must not exist)
    extra = [(None, 13, 36), (None, 18, 79), (None, 1, 48), (None, 13, 0)]

    def run(j):
        vid, ch, v = j
        url = URL.format(ch=ch, v=v)
        st, n, ct = head(url)
        return dict(verse_id=vid, chapter=ch, verse=v, url=url, status=st, bytes=n, content_type=ct)

    if cached and not refresh:
        res = cached["results"]  # reuse earlier HEAD results, only add the tree info
    else:
        with ThreadPoolExecutor(max_workers=5) as ex:
            res = list(ex.map(run, jobs + extra))
    tree = github_tree()
    files = {x["path"][len(PREFIX):]: x for x in tree["tree"]
             if x["type"] == "blob" and x["path"].startswith(PREFIX) and x["path"].endswith(".mp3")}
    by_sha = {}
    for pth, x in files.items():
        by_sha.setdefault(x["sha"], []).append(pth)
    for r in res:
        f = files.get("%d/%d.mp3" % (r["chapter"], r["verse"]))
        r["github_bytes"] = f["size"] if f else None
        r["sha"] = f["sha"] if f else None
        r["duplicate_of"] = [p for p in by_sha.get(f["sha"], []) if p != "%d/%d.mp3" % (r["chapter"], r["verse"])] if f else []
        r["fallback_url"] = RAW.format(ch=r["chapter"], v=r["verse"])
    known = {"%d/%d.mp3" % (r["chapter"], r["verse"]) for r in res}
    unexpected = sorted(p for p in files if p not in known)
    json.dump(dict(checked_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), tree_sha=tree["sha"],
                   results=res, github_files=len(files), github_unexpected_files=unexpected,
                   duplicate_groups=[v for v in by_sha.values() if len(v) > 1]),
              open(OUT, "w"), indent=1)
    vr = [r for r in res if r["verse_id"]]
    ok = [r for r in vr if r["status"] == 200]
    ingh = [r for r in vr if r["github_bytes"]]
    print("audio: %d/%d files in the GitHub repo (%.1f MB); unexpected files: %s"
          % (len(ingh), len(vr), sum(r["github_bytes"] for r in ingh) / 1e6, unexpected))
    print("audio: %d/%d served by jsDelivr right now; others: %s" % (
        len(ok), len(vr), sorted(set(str(r["status"]) for r in vr if r["status"] != 200))))
    print("audio: identical files:", [v for v in by_sha.values() if len(v) > 1])
    for r in res:
        if not r["verse_id"]:
            print("  spot-check (should not exist) %d/%d: jsDelivr %s, in repo: %s" % (
                r["chapter"], r["verse"], r["status"], bool(r["github_bytes"])))


if __name__ == "__main__":
    main()
