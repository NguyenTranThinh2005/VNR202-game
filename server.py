# Server dự phòng bằng Python 3 cho "Bắn Bóng Lịch Sử" (dùng khi máy không có Node.js).
# Chạy: python server.py   (đổi cổng: python server.py 8080)
import json, os, socket, sys, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data.json")
FILES = {"/": "index.html", "/index.html": "index.html", "/admin": "admin.html", "/admin.html": "admin.html"}
LOCK = threading.Lock()
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

try:
    with open(DATA, encoding="utf-8") as f:
        players = json.load(f)
except Exception:
    players = {}


def save():
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(players, f, ensure_ascii=False)


def lan_urls():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            if not info[4][0].startswith("127."):
                ips.add(info[4][0])
    except Exception:
        pass
    return [f"http://{ip}:{PORT}" for ip in sorted(ips)] or [f"http://localhost:{PORT}"]


def clip(v, n):
    return str(v if v is not None else "")[:n]


def num(v):
    try:
        return float(v) if v is not None else 0
    except (TypeError, ValueError):
        return 0


def update_player(b):
    if not isinstance(b, dict) or not isinstance(b.get("id"), str) or not b["id"]:
        return
    pid = clip(b["id"], 20)
    p = players.setdefault(pid, {"id": pid, "runIds": [], "best": 0, "firstSeen": int(time.time() * 1000)})
    run_id = clip(b.get("runId"), 20)
    if run_id and run_id not in p["runIds"]:
        p["runIds"].append(run_id)
    p.update({
        "name": clip(b.get("name"), 30), "hero": clip(b.get("hero"), 20), "screen": clip(b.get("screen"), 12),
        "stage": num(b.get("stage")), "stages": num(b.get("stages")), "stageName": clip(b.get("stageName"), 40),
        "hp": num(b.get("hp")), "maxHp": num(b.get("maxHp")), "score": num(b.get("score")),
        "result": b.get("result") if b.get("result") in ("win", "lose") else None,
        "correct": num(b.get("correct")), "wrong": num(b.get("wrong")), "sec": num(b.get("sec")),
        "plays": len(p["runIds"]), "lastSeen": int(time.time() * 1000),
    })
    if p["result"]:
        p["best"] = max(p["best"], p["score"])
    wins = p.setdefault("winRunIds", [])
    if p["result"] == "win" and run_id and run_id not in wins:
        wins.append(run_id)
    p["wins"] = len(wins)
    save()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send(self, code, body=b"", ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if body:
            self.wfile.write(body if isinstance(body, bytes) else body.encode("utf-8"))

    def do_POST(self):
        global players
        path = urlparse(self.path).path
        length = min(int(self.headers.get("Content-Length") or 0), 10000)
        body = self.rfile.read(length)
        with LOCK:
            if path == "/api/reset":
                players = {}
                save()
                return self.send(200, "{}")
            if path == "/api/status":
                try:
                    update_player(json.loads(body))
                except Exception:
                    pass
                return self.send(204)
        self.send(404)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/players":
            with LOCK:
                return self.send(200, json.dumps({"now": int(time.time() * 1000), "players": list(players.values())}, ensure_ascii=False))
        if path == "/api/info":
            return self.send(200, json.dumps({"urls": lan_urls()}))
        name = FILES.get(path)
        if not name:
            return self.send(404, "Không tìm thấy", "text/plain; charset=utf-8")
        with open(os.path.join(ROOT, "public", name), "rb") as f:
            self.send(200, f.read(), "text/html; charset=utf-8")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("\n  Bắn Bóng Lịch Sử đang chạy\n")
    for u in lan_urls():
        print(f"  Người chơi mở:  {u}")
        print(f"  Màn admin:      {u}/admin\n")
    print("  Giữ cửa sổ này mở trong lúc chơi. Nhấn Ctrl+C để tắt.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
