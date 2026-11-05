// Server nhỏ cho "Bắn Bóng Lịch Sử": phục vụ game, màn admin và lưu trạng thái người chơi.
// Không cần cài thêm thư viện. Chạy: node server.js   (đổi cổng: PORT=8080 node server.js)
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data.json");
const FILES = { "/": "index.html", "/index.html": "index.html", "/admin": "admin.html", "/admin.html": "admin.html" };

let players = {};
try { players = JSON.parse(fs.readFileSync(DATA, "utf8")); } catch (e) { players = {}; }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFile(DATA, JSON.stringify(players, null, 1), () => {}), 1000);
}

function lanUrls() {
  const urls = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === "IPv4" && !a.internal) urls.push(`http://${a.address}:${PORT}`);
  }
  return urls.length ? urls : [`http://localhost:${PORT}`];
}

const clip = (v, n) => String(v ?? "").slice(0, n);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function updatePlayer(b) {
  if (!b || typeof b.id !== "string" || !b.id) return;
  const id = clip(b.id, 20);
  const p = players[id] || (players[id] = { id, runIds: [], best: 0, firstSeen: Date.now() });
  const runId = clip(b.runId, 20);
  if (runId && !p.runIds.includes(runId)) p.runIds.push(runId);
  Object.assign(p, {
    name: clip(b.name, 30), hero: clip(b.hero, 20), screen: clip(b.screen, 12),
    stage: num(b.stage), stages: num(b.stages), stageName: clip(b.stageName, 40),
    hp: num(b.hp), maxHp: num(b.maxHp), score: num(b.score),
    result: b.result === "win" || b.result === "lose" ? b.result : null,
    correct: num(b.correct), wrong: num(b.wrong), sec: num(b.sec),
    plays: p.runIds.length, lastSeen: Date.now(),
  });
  if (p.result) p.best = Math.max(p.best, p.score);
  p.winRunIds = p.winRunIds || [];
  if (p.result === "win" && runId && !p.winRunIds.includes(runId)) p.winRunIds.push(runId);
  p.wins = p.winRunIds.length;
  save();
}

function send(res, code, body, type) {
  res.writeHead(code, { "Content-Type": type || "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && (url.pathname === "/api/status" || url.pathname === "/api/reset")) {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 10000) req.destroy(); });
    req.on("end", () => {
      if (url.pathname === "/api/reset") { players = {}; save(); return send(res, 200, "{}"); }
      try { updatePlayer(JSON.parse(body)); } catch (e) {}
      send(res, 204, "");
    });
    return;
  }
  if (url.pathname === "/api/players") return send(res, 200, JSON.stringify({ now: Date.now(), players: Object.values(players) }));
  if (url.pathname === "/api/info") return send(res, 200, JSON.stringify({ urls: lanUrls() }));
  const file = FILES[url.pathname];
  if (!file) return send(res, 404, "Không tìm thấy", "text/plain; charset=utf-8");
  fs.readFile(path.join(ROOT, "public", file), (err, data) => {
    if (err) return send(res, 500, "Lỗi đọc file", "text/plain; charset=utf-8");
    send(res, 200, data, "text/html; charset=utf-8");
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log("\n  Bắn Bóng Lịch Sử đang chạy\n");
  for (const u of lanUrls()) {
    console.log(`  Người chơi mở:  ${u}`);
    console.log(`  Màn admin:      ${u}/admin\n`);
  }
  console.log("  Giữ cửa sổ này mở trong lúc chơi. Nhấn Ctrl+C để tắt.\n");
});
