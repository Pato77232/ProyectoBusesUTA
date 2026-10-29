const express = require('express');
const createPaymentProofController = require('./payment-proof.controller');
const { parsePaymentProofMultipart } = require('./payment-proof-multipart');

function createPaymentProofRouter({ auth, uploadPaymentProof }) {
  const router = express.Router();
  const controller = createPaymentProofController({ uploadPaymentProof });

  router.post(
    '/',
    auth.authenticate,
    auth.authorize('CUSTOMER'),
    auth.csrfProtection,
    parsePaymentProofMultipart,
    controller.upload,
  );

  return router;
}

module.exports = createPaymentProofRouter;
