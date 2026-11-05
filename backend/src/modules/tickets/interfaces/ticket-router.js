const express = require('express');

/**
 * Rutas de Boletos para el CUSTOMER autenticado. El propietario sale de la sesión
 * verificada; el navegador solo indica qué reserva quiere ver.
 */
function createTicketRouter({ auth, viewOwnerTickets }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(auth.authenticate, auth.authorize('CUSTOMER'));
  router.get('/bookings/:bookingId', async (req, res) => {
    res.json(
      await viewOwnerTickets({ bookingId: req.params.bookingId, ownerId: req.auth?.user?.id }),
    );
  });
  return router;
}

module.exports = createTicketRouter;
