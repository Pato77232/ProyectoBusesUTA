const express = require('express');
const createPaymentProofController = require('./payment-proof.controller');
const { parsePaymentProofMultipart } = require('./payment-proof-multipart');

function createPaymentProofRouter({
  auth,
  uploadPaymentProof,
  listPendingPaymentProofs,
  readPaymentProofFile,
  approvePaymentProof,
  clock = () => new Date(),
}) {
  const router = express.Router();
  // La bandeja y los archivos privados no deben conservarse en cachés HTTP.
  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  const controller = createPaymentProofController({
    uploadPaymentProof,
    listPendingPaymentProofs,
    readPaymentProofFile,
    approvePaymentProof,
    clock,
  });

  router.get('/', auth.authenticate, auth.authorize('CLERK'), controller.listPending);
  router.get(
    '/:paymentProofId/file',
    auth.authenticate,
    auth.authorize('CLERK'),
    controller.readFile,
  );
  router.post(
    '/:paymentProofId/approve',
    auth.authenticate,
    auth.authorize('CLERK'),
    auth.csrfProtection,
    controller.approve,
  );

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
