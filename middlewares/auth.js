const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "secretjwtkey";

exports.isAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "غير مصرح" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "انتهت الجلسة، سجل دخول من جديد" });
  }
};

exports.isAdmin = (req, res, next) => {
  if (req.user?.role === "admin" || req.user?.role === "مدير") return next();
  res.status(403).json({ error: "هذه الصفحة للإدارة فقط" });
};
