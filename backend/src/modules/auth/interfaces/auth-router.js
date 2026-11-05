const express = require('express');
const { cookieOptions } = require('./cookies');
const validateCredentials = require('./credentials');
const authErrors = require('./auth-errors');
const { z } = require('zod');
const resetRequest = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();
function createRouter({
  login,
  csrf,
  authenticate,
  authorize,
  logout,
  register,
  createClerk,
  requestPasswordReset,
}) {
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
  router.post('/register', csrf.protect, validateCredentials, async (req, res) => {
    await register(req.credentials);
    res.status(201).end();
  });
  router.post('/password-reset', csrf.protect, async (req, res) => {
    const parsed = resetRequest.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'Correo inválido.' } });
    await requestPasswordReset({ email: parsed.data.email, ip: req.ip });
    res.status(202).json({ message: 'Si la cuenta existe, enviaremos un enlace.' });
  });
  router.post(
    '/clerks',
    authenticate,
    authorize('COOPERATIVE_ADMIN'),
    csrf.protect,
    validateCredentials,
    async (req, res) => {
      const user = await createClerk({
        ...req.credentials,
        cooperativeId: req.auth.user.cooperative_id,
      });
      res.status(201).json({ user });
    },
  );
  router.use(authErrors);
  return router;
}
module.exports = createRouter;
