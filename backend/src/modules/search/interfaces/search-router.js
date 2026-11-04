const express = require('express');
module.exports = ({ search }) => {
  const router = express.Router();
  router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await search(req.query));
  });
  return router;
};
