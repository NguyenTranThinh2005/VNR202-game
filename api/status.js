const { updatePlayer } = require("./_lib");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  try {
    let b = req.body;
    if (typeof b === "string") b = JSON.parse(b);
    await updatePlayer(b);
  } catch (e) {}
  res.status(204).end();
};
