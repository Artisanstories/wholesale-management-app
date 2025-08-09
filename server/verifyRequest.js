export function verifyRequest(req, res, next) {
  const cookieName = process.env.SESSION_COOKIE_NAME || "app_session";
  const raw = req.cookies?.[cookieName];
  if (!raw) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.shopifySession = JSON.parse(raw);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}
