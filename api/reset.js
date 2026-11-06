const { resetAll } = require("./_lib");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  const key = process.env.ADMIN_KEY;
  if (key && req.headers["x-admin-key"] !== key) return res.status(401).json({ error: "Sai mật khẩu admin" });
  try { await resetAll(); res.status(200).json({}); } catch (e) { res.status(500).json({ error: "Lỗi xóa dữ liệu" }); }
};
