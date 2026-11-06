const { listPlayers, persistent } = require("./_lib");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    res.status(200).json({ now: Date.now(), persistent, players: await listPlayers() });
  } catch (e) {
    res.status(500).json({ error: "Không đọc được dữ liệu" });
  }
};
