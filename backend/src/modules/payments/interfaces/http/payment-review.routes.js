const express = require('express');
const createPaymentProofController = require('./payment-proof.controller');
const pendingPaymentProofPage = require('./pending-payment-proof.presenter');

function createPaymentReviewRouter({ auth, listPaymentProofs, readPaymentProofFile }) {
  const router = express.Router();
  const { readFile } = createPaymentProofController({ readPaymentProofFile });
  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/', auth.authenticate, auth.authorize('CLERK'), async (request, response, next) => {
    try {
      const user = request.auth.user;
      const page = await listPaymentProofs.execute({
        authContext: { userId: user.id, role: user.role, cooperativeId: user.cooperative_id },
        cursor: request.query.cursor ?? null,
      });
      return response.json(pendingPaymentProofPage(page));
    } catch (error) {
      return next(error);
    }
  });
  router.get('/:paymentProofId/file', auth.authenticate, auth.authorize('CLERK'), readFile);
  return router;
}

module.exports = createPaymentReviewRouter;
