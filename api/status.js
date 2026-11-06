const { updatePlayer, isWatched } = require("./_lib");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  let watch = false;
  try {
    let b = req.body;
    if (typeof b === "string") b = JSON.parse(b);
    await updatePlayer(b);
    watch = await isWatched(b && b.id);
  } catch (e) {}
  res.status(200).json({ watch });
};
