"""Compare anu.decode_cluster with the OCR majority vote for every glyph cluster.

Prints clusters where the decoder disagrees with the top OCR reading, most frequent
first. Each such line was reviewed against the scan; known OCR confusions are listed
in OCR_CONFUSIONS and skipped.
"""
import json
import os
import sys

from anu import DecodeError, decode_cluster

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
VOTES = os.path.join(ROOT, "scripts", "out", "nirvikalpananda", "_cache", "cluster_votes.json")


def main(min_n=2):
    v = json.load(open(VOTES))
    bad = errs = agree = 0
    rows = []
    for g, d in sorted(v.items(), key=lambda kv: -kv[1]["n"]):
        try:
            u = decode_cluster(g)
        except DecodeError as e:
            errs += d["n"]
            rows.append((d["n"], f"ERR {g!r} {e} {d['votes'][:3]} {d['ex'][:2]}"))
            continue
        top = d["votes"][0][0]
        if u == top:
            agree += d["n"]
        else:
            bad += d["n"]
            if d["n"] >= min_n:
                share = {a: n for a, n in d["votes"]}.get(u, 0)
                rows.append((d["n"], f"{g!r} -> {u}  ocr {d['votes'][:3]}  (ours {share}/{d['n']}) {d['ex'][:2]}"))
    print(f"agree {agree}  disagree {bad}  decode errors {errs}")
    for n, r in rows:
        print(n, r)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 2)
