export function requireAuth(req, res, next) {
  if (req.signedCookies.session === 'authenticated') {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}
