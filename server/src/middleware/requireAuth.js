import { clientFromSession } from "../googleClient.js";

export function requireAuth(req, res, next) {
  if (!req.session.tokens) return res.status(401).json({ error: "Not signed in" });
  req.oauth2Client = clientFromSession(req.session);
  next();
}
