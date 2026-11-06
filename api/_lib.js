// Lưu trạng thái người chơi. Có Upstash Redis (khuyên dùng) thì dữ liệu bền và dùng chung mọi máy chủ;
// không có thì lưu tạm trong bộ nhớ (chỉ để chạy thử, có thể mất dữ liệu).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const mem = globalThis.__bbls || (globalThis.__bbls = { players: {} });

async function cmd(commands) {
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
    correct: num(b.correct), wrong: num(b.wrong), sec: num(b.sec),
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

module.exports = { updatePlayer, listPlayers, resetAll, persistent: !!URL_ };
