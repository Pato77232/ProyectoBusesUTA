const express = require('express');

function createSeatLayoutRouter({ auth, listSeatLayouts }) {
  const router = express.Router();
  router.get('/', auth.authenticate, auth.authorize('COOPERATIVE_ADMIN'), async (req, res) => {
    res.json({ seatLayouts: await listSeatLayouts() });
  });
  return router;
}

module.exports = createSeatLayoutRouter;
