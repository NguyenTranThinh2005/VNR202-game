module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  res.status(200).json({ urls: [`https://${host}`], needKey: !!process.env.ADMIN_KEY });
};
