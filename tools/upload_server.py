#!/usr/bin/env python3
"""Tiny developer server: lets a page POST a file to music-preview/ (used by tools/music-preview.js).
Run:  python tools/upload_server.py      (listens on 127.0.0.1:8770, accepts only local requests)"""
import http.server
import pathlib
import re

OUT = pathlib.Path(__file__).resolve().parent.parent / "music-preview"


class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        name = re.sub(r"[^A-Za-z0-9._-]", "_", self.path.lstrip("/save/")[:80] or "file.bin")
        n = int(self.headers.get("Content-Length", 0))
        if n > 40_000_000:
            self.send_response(413); self._cors(); self.end_headers(); return
        OUT.mkdir(exist_ok=True)
        (OUT / name).write_bytes(self.rfile.read(n))
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b"ok")
        print("saved", name, n)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    http.server.HTTPServer(("127.0.0.1", 8770), H).serve_forever()
