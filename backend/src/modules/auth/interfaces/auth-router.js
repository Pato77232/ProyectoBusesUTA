const express = require('express');
const { cookieOptions } = require('./cookies');
const validateCredentials = require('./credentials');
const authErrors = require('./auth-errors');
function createRouter({ login, csrf, authenticate, logout }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/csrf', csrf.issue);
  router.post('/login', csrf.protect, validateCredentials, async (req, res) => {
    const result = await login({ ...req.credentials, ip: req.ip });
    res.cookie('access_token', result.token, { ...cookieOptions(req), expires: result.expiresAt });
    res.status(200).end();
  });
  router.get('/me', authenticate, (req, res) => res.json({ user: req.auth.user }));
  router.post('/logout', authenticate, csrf.protect, async (req, res) => {
    await logout(req.auth);
    res.clearCookie('access_token', cookieOptions(req));
    res.status(204).end();
  });
  router.use(authErrors);
  return router;
}
module.exports = createRouter;
