const express = require('express');

/**
 * Rutas de Boletos para el CUSTOMER autenticado y la reimpresión de boletería del CLERK.
 * El propietario sale de la sesión verificada; el navegador solo indica qué reserva quiere ver.
 */
function createTicketRouter({ auth, viewOwnerTickets, getGoogleWalletLink, googleWalletEnabled }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // BOOK-CAJA-02: el oficinista ve y reimprime los boletos de las ventas de boletería de su
  // cooperativa. El propietario `counter:<cooperativa>` sale de la sesión, nunca de la URL.
  router.get(
    '/counter/bookings/:bookingId',
    auth.authenticate,
    auth.authorize('CLERK'),
    async (req, res) => {
      const cooperativeId = req.auth?.user?.cooperative_id;
      res.json(
        await viewOwnerTickets({
          bookingId: req.params.bookingId,
          ownerId:
            typeof cooperativeId === 'string' ? `counter:${cooperativeId.toLowerCase()}` : '',
        }),
      );
    },
  );
  router.use(auth.authenticate, auth.authorize('CUSTOMER'));
  // BOLETOS-03: Google Wallet. Sin configuración, el estado responde deshabilitado.
  router.get('/google-wallet/status', (req, res) => {
    res.json({ enabled: googleWalletEnabled === true });
  });
  router.get('/bookings/:bookingId/tickets/:ticketId/google-wallet', async (req, res) => {
    res.json(
      await getGoogleWalletLink({
        bookingId: req.params.bookingId,
        ticketId: req.params.ticketId,
        ownerId: req.auth?.user?.id,
      }),
    );
  });
  router.get('/bookings/:bookingId', async (req, res) => {
    res.json(
      await viewOwnerTickets({ bookingId: req.params.bookingId, ownerId: req.auth?.user?.id }),
    );
  });
  return router;
}

module.exports = createTicketRouter;
