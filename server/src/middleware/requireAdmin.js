export function requireAdmin(req, res, next) {
  if (!req.session.profile || req.session.profile.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }
  next();
}
