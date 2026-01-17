const express = require('express');
const passport = require('passport');
const { z } = require('zod');
const User = require('../models/User');

function authRouter({ allowDevLogin, googleEnabled }) {
  const router = express.Router();

  router.get('/auth/google', (req, res, next) => {
    if (!googleEnabled) {
      return res.status(400).json({ error: 'Google OAuth not configured' });
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  router.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
      res.redirect('/');
    }
  );

  router.post('/auth/dev-login', async (req, res, next) => {
    if (!allowDevLogin) return res.status(403).json({ error: 'Dev login disabled' });
    const schema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.message });
    const { email, name } = parse.data;
    try {
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ email, name: name || email.split('@')[0] });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        res.json({ user });
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/logout', (req, res, next) => {
    req.logout(function logoutDone(err) {
      if (err) return next(err);
      req.session?.destroy(() => {
        res.json({ ok: true });
      });
    });
  });

  return router;
}

module.exports = authRouter;
