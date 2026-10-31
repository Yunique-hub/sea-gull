#!/usr/bin/env python3
"""SEAGULL-LAB-20261031 local fixture with intentional vulnerabilities.

Runs only on 127.0.0.1. Target owned by the operator; no external traffic.
"""
import json
import sqlite3
import urllib.parse
import urllib.request
import subprocess
import threading
import argparse
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST, PORT = "127.0.0.1", 18080
OUTPUT = Path(__file__).parent
DB = ":memory:"
_ROWS = [
    (101, "alice", "alice-only-secret"),
    (102, "bob", "bob-private-note"),
    (201, "admin", "flag{seagull_idor_pwned}"),
]


def _db():
    con = sqlite3.connect(DB, check_same_thread=False)
    con.execute("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, owner TEXT, body TEXT)")
    if not con.execute("SELECT COUNT(*) FROM notes").fetchone()[0]:
        con.executemany("INSERT INTO notes VALUES (?,?,?)", _ROWS)
    con.commit()
    return con


CON = _db()
LOCK = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    server_version = "SeagullLab/1.0"

    def log_message(self, fmt, *args):
        line = "REQ %s %s\n" % (self.command, self.path)
        with (OUTPUT / "access.log").open("a", encoding="utf-8") as fh:
            fh.write(line)

    def _send(self, code, body, ctype="application/json"):
        raw = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path, _, query = self.path.partition("?")
        if path == "/api/note":
            # IDOR: no authorization check on note id
            note_id = query.split("=", 1)[1] if "=" in query else ""
            with LOCK:
                row = CON.execute("SELECT id, owner, body FROM notes WHERE id=?", (note_id,)).fetchone()
            if row:
                return self._send(200, json.dumps({"id": row[0], "owner": row[1], "body": row[2]}))
            return self._send(404, json.dumps({"error": "not found"}))
        if path == "/api/search":
            # SQL injection: query string concatenated
            term = urllib.parse.unquote(query.split("=", 1)[1]) if "=" in query else ""
            sql = "SELECT id, owner FROM notes WHERE owner = '%s'" % term
            try:
                with LOCK:
                    rows = CON.execute(sql).fetchall()
                return self._send(200, json.dumps({"sql": sql, "rows": rows}))
            except Exception as exc:  # noqa: BLE001 - lab fixture
                return self._send(500, json.dumps({"sql": sql, "error": str(exc)}))
        if path == "/api/fetch":
            # Demonstrate server-side fetching only against this fixture or its sample.
            target = urllib.parse.unquote(query.split("=", 1)[1]) if "=" in query else ""
            if target not in ("http://127.0.0.1:18080/", (OUTPUT / "sample.txt").resolve().as_uri()):
                return self._send(403, json.dumps({"error": "outside fixture"}))
            try:
                with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(target, timeout=3) as resp:
                    return self._send(200, resp.read()[:400].decode("utf-8", "replace"))
            except Exception as exc:  # noqa: BLE001 - lab fixture
                return self._send(502, json.dumps({"error": str(exc)}))
        if path == "/api/ping":
            # command injection: shell=True with user input
            who = urllib.parse.unquote(query.split("=", 1)[1]) if "=" in query else "127.0.0.1"
            if who not in ("127.0.0.1", "127.0.0.1 & echo SEAGULL_CMDI_MARKER"):
                return self._send(403, json.dumps({"error": "outside fixture"}))
            try:
                out = subprocess.run("ping -n 1 %s" % who, shell=True, capture_output=True, text=True, timeout=5)
                return self._send(200, json.dumps({"out": (out.stdout or out.stderr)[:400]}))
            except Exception as exc:  # noqa: BLE001 - lab fixture
                return self._send(500, json.dumps({"error": str(exc)}))
        if path == "/":
            return self._send(200, "<html><body><h1>Seagull Lab</h1><p>fixture</p></body></html>", "text/html")
        return self._send(404, json.dumps({"error": "no route"}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    OUTPUT = parser.parse_args().output_dir.resolve()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "sample.txt").write_text("SEAGULL_FIXTURE_FILE_ONLY\n", encoding="utf-8")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
