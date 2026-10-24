"""Single entry point: rebuild everything under scripts/out/build and assets/db.

    scripts/.venv/bin/python scripts/build_db/build.py [--refresh-audio] [--measure]

Steps (each fails the build on error / unexplained validation outliers):
  1. build_verses.py     sloka structure, IAST, search keys, formatting_changes.md
  2. validate_verses.py  structure + cross-check vs Besant 1922 / DCS
  3. clean_texts.py      translations / commentaries / summaries -> blocks, text_cleanup_report.md, review/
  4. validate_texts.py   typography + block validators
  5. build_words.py      DCS word analysis + parsed word meanings
  6. check_audio.py      jsDelivr HEAD check (cached; --refresh-audio to re-check)
  7. build_sqlite.py     assets/db/gita.db + assets/db/gita-lite.json (--measure: FTS size variants)
  8. test/test_db_js.mjs smoke test of src/gita-data/db.js against the built DB (needs node)
"""
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PY = sys.executable


def run(args, **kw):
    print("\n==>", " ".join(os.path.relpath(a, ROOT) if os.path.isabs(a) else a for a in args), flush=True)
    r = subprocess.run(args, cwd=ROOT, **kw)
    if r.returncode:
        sys.exit("build failed at: %s" % " ".join(args))


def main():
    run([PY, os.path.join(HERE, "build_verses.py")])
    run([PY, os.path.join(HERE, "validate_verses.py")])
    run([PY, os.path.join(HERE, "clean_texts.py")])
    run([PY, os.path.join(HERE, "validate_texts.py")])
    run([PY, os.path.join(HERE, "build_words.py")])
    run([PY, os.path.join(HERE, "check_audio.py")] + (["--refresh"] if "--refresh-audio" in sys.argv else []))
    run([PY, os.path.join(HERE, "build_sqlite.py")] + (["--measure"] if "--measure" in sys.argv else []))
    if shutil.which("node"):
        run(["node", os.path.join(HERE, "test", "test_db_js.mjs")])
    else:
        print("node not found: skipped db.js smoke test")
    print("\nOK: assets/db/gita.db, assets/db/gita-lite.json")


if __name__ == "__main__":
    main()
