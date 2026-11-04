const express = require('express');
const errors = require('../application/booking-errors');
module.exports = ({ auth, reviews }) => {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.post(
    '/',
    auth.authenticate,
    auth.authorize('CLERK'),
    auth.csrfProtection,
    async (req, res) => {
      try {
        if (!req.is('application/json'))
          return res
            .status(415)
            .json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Se requiere JSON.' } });
        res.status(201).json({ review: await reviews.review(req.body, req.auth) });
      } catch (error) {
        if (error instanceof errors.BookingValidationError)
          return res.status(400).json({ error: { code: error.code, message: error.message } });
        if (error instanceof errors.BookingAccessError)
          return res.status(403).json({ error: { code: error.code, message: error.message } });
        if (error instanceof errors.BookingTripUnavailableError)
          return res.status(404).json({ error: { code: error.code, message: error.message } });
        throw error;
      }
    },
  );
  return router;
};
