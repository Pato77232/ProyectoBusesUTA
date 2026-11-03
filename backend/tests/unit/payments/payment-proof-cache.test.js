const http = require('node:http');
const express = require('express');
const createPaymentProofRouter = require('../../../src/modules/payments/interfaces/http/payment-proof.routes');

test('listado, archivo y denegación de Pagos impiden caché HTTP', async () => {
  let authenticated = true;
  const pass = (req, res, next) => next();
  const app = express();
  app.use(
    '/api/v1/payment-proofs',
    createPaymentProofRouter({
      auth: {
        authenticate(req, res, next) {
          if (!authenticated) return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });
          req.auth = { user: { cooperative_id: 'tenant-QA' } };
          return next();
        },
        authorize: () => pass,
        csrfProtection: pass,
      },
      listPendingPaymentProofs: { execute: async () => ({ items: [], nextCursor: null }) },
      readPaymentProofFile: {
        execute: async () => ({
          content: Buffer.from('solo-QA'),
          mediaType: 'image/png',
          originalFileName: 'qa.png',
        }),
      },
    }),
  );
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/api/v1/payment-proofs', '/api/v1/payment-proofs/qa/file']) {
      const response = await fetch(origin + path);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      await response.arrayBuffer();
    }
    authenticated = false;
    const denied = await fetch(origin + '/api/v1/payment-proofs/qa/file');
    expect(denied.status).toBe(401);
    expect(denied.headers.get('cache-control')).toBe('no-store');
    await denied.arrayBuffer();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
