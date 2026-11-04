const express = require('express');

// Consumo público de un enlace de invitado: uso único, sin sesión y sin caché.
function createGuestBookingRouter({ guestAccess }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/:token', async (req, res) => {
    res.json({ booking: await guestAccess.consume(req.params.token) });
  });
  return router;
}

module.exports = createGuestBookingRouter;
