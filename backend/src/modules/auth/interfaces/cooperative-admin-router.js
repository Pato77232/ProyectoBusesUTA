const express = require('express');
const { z } = require('zod');
const validateCredentials = require('./credentials');
const authErrors = require('./auth-errors');
function validateCooperativeId(req, res, next) {
  if (!z.uuid().safeParse(req.params.cooperativeId).success)
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Identificador de cooperativa inválido.' },
    });
  next();
}
function createAdminRouter({ authenticate, authorize, csrf, createAdmin }) {
  const router = express.Router();
  router.post(
    '/:cooperativeId/admins',
    authenticate,
    authorize('SYSTEM_ADMIN'),
    csrf.protect,
    validateCooperativeId,
    validateCredentials,
    async (req, res) => {
      const user = await createAdmin({
        ...req.credentials,
        cooperativeId: req.params.cooperativeId,
      });
      res.set('Cache-Control', 'no-store').status(201).json({ user });
    },
  );
  router.use(authErrors);
  return router;
}
module.exports = createAdminRouter;
