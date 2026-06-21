import { Router } from 'express';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.APP_PASSWORD) {
    res.cookie('session', 'authenticated', {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Invalid password' });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

authRouter.get('/check', (req, res) => {
  if (req.signedCookies.session === 'authenticated') {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Unauthorized' });
});
