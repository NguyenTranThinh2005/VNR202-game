// Lưu trạng thái người chơi. Có Upstash Redis (khuyên dùng) thì dữ liệu bền và dùng chung mọi máy chủ;
// không có thì lưu tạm trong bộ nhớ (chỉ để chạy thử, có thể mất dữ liệu).
// Hỗ trợ 2 loại: Upstash (REST: KV_REST_API_URL + TOKEN) hoặc Redis thường (REDIS_URL dạng redis://...).
const REST = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const RURL = process.env.REDIS_URL || process.env.KV_URL ||
  Object.entries(process.env).find(([k, v]) => /REDIS_URL$/.test(k) && /^rediss?:\/\//.test(v || ""))?.[1];
const URL_ = REST || RURL; // có kho lưu bền hay không
const mem = globalThis.__bbls || (globalThis.__bbls = { players: {}, frames: {}, watch: {} });

// kết nối Redis thường: giữ lại giữa các lần gọi để không phải kết nối lại
function redisClient() {
  if (!globalThis.__bblsRedis) {
    const { createClient } = require("redis");
    const c = createClient({ url: RURL, socket: { connectTimeout: 5000 } });
    c.on("error", () => {});
    globalThis.__bblsRedis = c.connect().then(() => c).catch((e) => { globalThis.__bblsRedis = null; throw e; });
  }
  return globalThis.__bblsRedis;
}

async function cmd(commands) {
  if (!REST) {
    const c = await redisClient();
    return Promise.all(commands.map((a) => c.sendCommand(a.map(String))));
  }
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`Redis ${r.status}`);
  return (await r.json()).map((x) => x.result);
}

const clip = (v, n) => String(v ?? "").slice(0, n);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

async function getPlayer(id) {
  if (!URL_) return mem.players[id];
  const [raw] = await cmd([["GET", `bbls:p:${id}`]]);
  return raw ? JSON.parse(raw) : undefined;
}
async function setPlayer(p) {
  if (!URL_) { mem.players[p.id] = p; return; }
  await cmd([["SET", `bbls:p:${p.id}`, JSON.stringify(p)], ["SADD", "bbls:ids", p.id]]);
}

async function updatePlayer(b) {
  if (!b || typeof b.id !== "string" || !b.id) return;
  const id = clip(b.id, 20).replace(/[^\w-]/g, "");
  if (!id) return;
  const p = (await getPlayer(id)) || { id, runIds: [], winRunIds: [], best: 0, firstSeen: Date.now() };
  const runId = clip(b.runId, 20);
  if (runId && !p.runIds.includes(runId)) p.runIds.push(runId);
  Object.assign(p, {
    name: clip(b.name, 30), hero: clip(b.hero, 20), screen: clip(b.screen, 12),
    stage: num(b.stage), stages: num(b.stages), stageName: clip(b.stageName, 40),
    hp: num(b.hp), maxHp: num(b.maxHp), score: num(b.score),
    result: b.result === "win" || b.result === "lose" ? b.result : null,
    correct: num(b.correct), wrong: num(b.wrong), sec: num(b.sec), streak: num(b.streak),
    plays: p.runIds.length, lastSeen: Date.now(),
  });
  if (p.result) p.best = Math.max(p.best, p.score);
  if (p.result === "win" && runId && !p.winRunIds.includes(runId)) p.winRunIds.push(runId);
  p.wins = p.winRunIds.length;
  await setPlayer(p);
}

async function listPlayers() {
  if (!URL_) return Object.values(mem.players);
  const [ids] = await cmd([["SMEMBERS", "bbls:ids"]]);
  if (!ids || !ids.length) return [];
  const vals = await cmd(ids.map((i) => ["GET", `bbls:p:${i}`]));
  return vals.filter(Boolean).map((v) => JSON.parse(v));
}

async function resetAll() {
  if (!URL_) { mem.players = {}; return; }
  const [ids] = await cmd([["SMEMBERS", "bbls:ids"]]);
  const dels = (ids || []).map((i) => ["DEL", `bbls:p:${i}`]);
  await cmd([...dels, ["DEL", "bbls:ids"]]);
}

const cleanId = (v) => clip(v, 20).replace(/[^\w-]/g, "");

// Xem trực tiếp: admin đang xem ai thì ghi cờ bbls:w:<id> (hết hạn sau 6 giây nếu admin thôi xem);
// máy người chơi thấy cờ thì gửi ảnh chụp màn hình nhỏ vào bbls:f:<id> (hết hạn sau 20 giây).
async function isWatched(id) {
  id = cleanId(id); if (!id) return false;
  if (!URL_) return (mem.watch[id] || 0) > Date.now();
  const [n] = await cmd([["EXISTS", `bbls:w:${id}`]]);
  return n > 0;
}
async function putFrame(id, img, note) {
  id = cleanId(id);
  if (!id || typeof img !== "string" || !img.startsWith("data:image/") || img.length > 400000) return false;
  const f = JSON.stringify({ img, note: clip(note, 60), t: Date.now() });
  if (!URL_) { mem.frames[id] = f; return isWatched(id); }
  const [, n] = await cmd([["SET", `bbls:f:${id}`, f, "EX", 20], ["EXISTS", `bbls:w:${id}`]]);
  return n > 0;
}
async function watchFrame(id) {
  id = cleanId(id); if (!id) return null;
  if (!URL_) { mem.watch[id] = Date.now() + 6000; return mem.frames[id] ? JSON.parse(mem.frames[id]) : null; }
  const [, raw] = await cmd([["SET", `bbls:w:${id}`, "1", "EX", 6], ["GET", `bbls:f:${id}`]]);
  return raw ? JSON.parse(raw) : null;
}

module.exports = { updatePlayer, listPlayers, resetAll, isWatched, putFrame, watchFrame, persistent: !!URL_ };
