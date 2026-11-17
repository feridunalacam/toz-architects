#!/usr/bin/env python3
"""toz+ architects — local admin server.

Serves the site folder on 127.0.0.1 and adds the small API that /admin uses to upload
images, save content and publish with git. Nothing is reachable from outside this Mac.

    /usr/bin/python3 tools/admin_server.py [--port 4173] [--open]
"""
import argparse
import json
import mimetypes
import os
import re
import subprocess
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent.parent
MAX_FILE = 40 * 1024 * 1024
MAX_SAVE = 16 * 1024 * 1024

UPLOAD = re.compile(r"^assets/(uploads/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp)|plans/[a-z0-9][a-z0-9-]*\.svg)$")
PLAN = re.compile(r"^assets/plans/[a-z0-9][a-z0-9-]*\.svg$")
DETAIL = re.compile(r"^(projeler|en/projects)/[a-z0-9][a-z0-9-]*\.html$")
DETAIL_DIRS = ("projeler", "en/projects")
PAGES = {
    "index.html", "projeler.html", "ekip.html", "iletisim.html", "pratik.html", "ofis.html", "404.html", "sitemap.xml",
    "en/index.html", "en/projects.html", "en/team.html", "en/contact.html", "en/practice.html", "en/studio.html",
}
PUBLISH = ["content", "assets/uploads", "assets/plans", "projeler", "en", *sorted(p for p in PAGES if "/" not in p)]
IMAGE_DIRS = ("assets/photos", "assets/atolye", "assets/materials", "assets/uploads")
IDENTITY = ["-c", "user.name=feridunalacam", "-c", "user.email=244065572+feridunalacam@users.noreply.github.com"]
MAGIC = {".jpg": [b"\xff\xd8\xff"], ".jpeg": [b"\xff\xd8\xff"], ".png": [b"\x89PNG"], ".webp": [b"RIFF"]}

mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("font/woff2", ".woff2")


def git(*args, timeout=60):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=timeout)


def write(rel, data):
    target = ROOT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_name(target.name + ".tmp")
    tmp.write_bytes(data if isinstance(data, bytes) else data.encode("utf-8"))
    os.replace(tmp, target)


class Handler(SimpleHTTPRequestHandler):
    server_version = "toz-admin"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/"):
            sys.stderr.write("%s %s\n" % (self.command, self.path.split("?")[0]))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def send_json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def fail(self, code, message):
        self.send_json({"ok": False, "error": message}, code)

    # Requests must come from the admin page itself: right Host (blocks DNS rebinding), a custom
    # header (blocks plain cross-site forms and forces a CORS preflight this server never grants).
    def host_ok(self):
        return self.headers.get("Host", "") in self.server.hosts

    def trusted(self):
        if self.headers.get("X-Toz") != "1":
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in self.server.origins:
            return False
        return self.headers.get("Sec-Fetch-Site", "same-origin") in ("same-origin", "none")

    def body(self, limit):
        try:
            size = int(self.headers.get("Content-Length", "-1"))
        except ValueError:
            size = -1
        if size < 0 or size > limit:
            self.fail(413, "Dosya çok büyük.")
            return None
        return self.rfile.read(size)

    def do_HEAD(self):
        if not self.host_ok():
            return self.fail(421, "İzin verilmeyen adres.")
        return super().do_HEAD()

    def do_GET(self):
        if not self.host_ok():
            return self.fail(421, "İzin verilmeyen adres.")
        path = urlsplit(self.path).path
        if path.startswith("/api/"):
            if not self.trusted():
                return self.fail(403, "İzin verilmeyen istek.")
            if path == "/api/ping":
                return self.send_json({"ok": True, "app": "toz-admin", "git": (ROOT / ".git").exists()})
            if path == "/api/images":
                return self.api_images()
            if path == "/api/status":
                return self.api_status()
            return self.fail(404, "Bilinmeyen istek.")
        if any(part.startswith(".") for part in path.split("/") if part):
            return self.fail(404, "Bulunamadı.")
        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/admin/")
            self.end_headers()
            return None
        return super().do_GET()

    def do_POST(self):
        if not self.host_ok():
            return self.fail(421, "İzin verilmeyen adres.")
        if not self.trusted():
            return self.fail(403, "İzin verilmeyen istek.")
        route = {"/api/file": self.api_file, "/api/save": self.api_save, "/api/publish": self.api_publish}
        handler = route.get(urlsplit(self.path).path)
        if not handler:
            return self.fail(404, "Bilinmeyen istek.")
        try:
            return handler()
        except Exception as err:  # keep the server alive and tell the page what went wrong
            return self.fail(500, "Sunucu hatası: %s" % err)

    def api_images(self):
        found = []
        for d in IMAGE_DIRS:
            folder = ROOT / d
            if folder.is_dir():
                found += sorted(f"{d}/{f.name}" for f in folder.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"))
        return self.send_json({"ok": True, "images": found})

    def api_status(self):
        if not (ROOT / ".git").exists():
            return self.send_json({"ok": True, "changes": 0, "ahead": 0})
        paths = [p for p in PUBLISH if (ROOT / p).exists()]
        changes = [line for line in git("status", "--porcelain", "--", *paths).stdout.splitlines() if line.strip()]
        ahead = git("rev-list", "--count", "@{u}..HEAD").stdout.strip()
        return self.send_json({"ok": True, "changes": len(changes), "ahead": int(ahead) if ahead.isdigit() else 0})

    def api_file(self):
        rel = parse_qs(urlsplit(self.path).query).get("path", [""])[0]
        if not UPLOAD.match(rel):
            return self.fail(400, "İzin verilmeyen dosya yolu: " + rel)
        data = self.body(MAX_FILE)
        if data is None:
            return None
        suffix = Path(rel).suffix.lower()
        if suffix == ".svg":
            if b"<svg" not in data.lower() or b"<script" in data.lower():
                return self.fail(400, "SVG okunamadı ya da betik içeriyor.")
        elif not any(data.startswith(m) for m in MAGIC[suffix]):
            return self.fail(400, "Dosyanın içeriği uzantısıyla uyuşmuyor.")
        write(rel, data)
        return self.send_json({"ok": True, "path": rel, "bytes": len(data)})

    def api_save(self):
        raw = self.body(MAX_SAVE)
        if raw is None:
            return None
        payload = json.loads(raw.decode("utf-8"))
        text, files = payload.get("content"), payload.get("files")
        if not isinstance(text, str) or not isinstance(files, dict):
            return self.fail(400, "Geçersiz istek.")
        json.loads(text)
        bad = [p for p in files if not (p in PAGES or DETAIL.match(p) or PLAN.match(p)) or not isinstance(files[p], str)]
        if bad:
            return self.fail(400, "İzin verilmeyen dosya yolu: " + ", ".join(bad[:5]))
        if "index.html" not in files or not any(DETAIL.match(p) for p in files):
            return self.fail(400, "Site eksik üretildi, kaydedilmedi.")
        write("content/site.json", text if text.endswith("\n") else text + "\n")
        for rel, page in files.items():
            write(rel, page)
        removed = []
        for d in DETAIL_DIRS:
            folder = ROOT / d
            for f in folder.glob("*.html") if folder.is_dir() else []:
                if f"{d}/{f.name}" not in files:
                    f.unlink()
                    removed.append(f"{d}/{f.name}")
        return self.send_json({"ok": True, "written": len(files) + 1, "removed": removed})

    def api_publish(self):
        raw = self.body(64 * 1024)
        if raw is None:
            return None
        payload = json.loads(raw.decode("utf-8") or "{}")
        message = " ".join(str(payload.get("message") or "").split())[:200] or "İçerik güncellemesi"
        if not (ROOT / ".git").exists():
            return self.fail(400, "Bu klasör bir git deposu değil.")
        paths = [p for p in PUBLISH if (ROOT / p).exists()]
        steps = [git("add", "-A", "--", *paths)]
        committed = git("diff", "--cached", "--quiet").returncode != 0
        if committed:
            identity = [] if git("config", "user.email").stdout.strip() else IDENTITY
            steps.append(git(*identity, "commit", "-q", "-m", message))
            if steps[-1].returncode != 0:
                return self.send_json({"ok": False, "error": "Değişiklikler paketlenemedi (git commit).", "log": steps[-1].stderr[-2000:]}, 500)
        push = git("push", "origin", "HEAD", timeout=180)
        sha = git("rev-parse", "--short", "HEAD").stdout.strip()
        log = (push.stdout + push.stderr)[-2000:]
        if push.returncode != 0:
            return self.send_json({"ok": False, "error": "GitHub’a gönderilemedi. İnternet bağlantısını ve GitHub girişini kontrol edin.", "commit": sha, "log": log}, 500)
        return self.send_json({"ok": True, "commit": sha, "committed": committed, "log": log})


def main():
    parser = argparse.ArgumentParser(description="toz+ admin")
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--open", action="store_true", help="open the admin in the browser")
    args = parser.parse_args()
    for port in range(args.port, args.port + 20):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    else:
        sys.exit("No free port between %d and %d." % (args.port, args.port + 19))
    httpd.hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
    httpd.origins = {f"http://{h}" for h in httpd.hosts}
    url = f"http://127.0.0.1:{port}/admin/"
    print(f"toz+ admin  →  {url}")
    print("Kapatmak için bu pencereyi kapatın ya da Ctrl+C’ye basın.")
    if args.open:
        threading.Timer(0.5, webbrowser.open, [url]).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
