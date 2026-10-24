"""stdin: JSON {db, sql, params} -> stdout: JSON rows (used by test_db_js.mjs; node's sqlite has no FTS5)."""
import json, sqlite3, sys
req = json.load(sys.stdin)
con = sqlite3.connect("file:%s?mode=ro" % req["db"], uri=True)
con.row_factory = sqlite3.Row
rows = [dict(r) for r in con.execute(req["sql"], req.get("params") or [])]
json.dump(rows, sys.stdout, ensure_ascii=False)
