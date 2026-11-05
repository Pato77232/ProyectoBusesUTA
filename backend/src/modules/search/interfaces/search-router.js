const express = require('express');
module.exports = ({ search, upcoming }) => {
  const router = express.Router();
  // SEARCH-02: próximas salidas sin escribir origen, destino y fecha.
  router.get('/upcoming', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await upcoming(req.query));
  });
  router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await search(req.query));
  });
  return router;
};
