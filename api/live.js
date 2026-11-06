// Xem trực tiếp màn hình người chơi.
// POST {id, img, note}: máy người chơi gửi ảnh chụp; trả về {watch} để biết admin còn xem không.
// GET ?id=...: màn admin lấy ảnh mới nhất (đồng thời báo "đang xem" cho người chơi đó).
const { putFrame, watchFrame } = require("./_lib");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "POST") {
      let b = req.body;
      if (typeof b === "string") b = JSON.parse(b);
      return res.status(200).json({ watch: await putFrame(b && b.id, b && b.img, b && b.note) });
    }
    const id = String((req.query && req.query.id) || "");
    res.status(200).json({ now: Date.now(), frame: await watchFrame(id) });
  } catch (e) {
    res.status(500).json({ error: "Lỗi xem trực tiếp" });
  }
};
