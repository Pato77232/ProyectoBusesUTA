const express = require('express');
const Failure = require('../domain/benefit-request-error');
module.exports = function createBenefitRequestRouter({ auth, requests }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(auth.authenticate);
  router.post('/', auth.authorize('CUSTOMER'), auth.csrfProtection, async (req, res) => {
    if (!req.is('application/json'))
      return res
        .status(415)
        .json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Se requiere JSON.' } });
    if (Object.keys(req.query).length) throw new Failure('BOOKING_BENEFIT_REQUEST_INVALID');
    const result = await requests.create(req.body, req.auth);
    res.status(result.created ? 201 : 200).json({ request: result.request });
  });
  router.post(
    '/:requestId/review',
    auth.authorize('CLERK'),
    auth.csrfProtection,
    async (req, res) => {
      if (!req.is('application/json'))
        return res
          .status(415)
          .json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Se requiere JSON.' } });
      if (Object.keys(req.query).length) throw new Failure('BOOKING_BENEFIT_REQUEST_INVALID');
      res.json({ request: await requests.review(req.params.requestId, req.body, req.auth) });
    },
  );
  router.get('/', auth.authorize('CLERK'), async (req, res) => {
    res.json(await requests.list(req.query, req.auth));
  });
  router.get('/:requestId', auth.authorize('CUSTOMER', 'CLERK'), async (req, res) => {
    if (Object.keys(req.query).length) throw new Failure('BOOKING_BENEFIT_REQUEST_INVALID');
    res.json({ request: await requests.get(req.params.requestId, req.auth) });
  });
  return router;
};
