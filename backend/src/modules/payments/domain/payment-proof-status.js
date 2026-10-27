const { PaymentProofValidationError } = require('./payment-proof-error');

const PAYMENT_PROOF_STATUSES = Object.freeze(['AWAITING_UPLOAD', 'UPLOADED', 'EXPIRED']);

function validatePaymentProofStatus(status) {
  if (!PAYMENT_PROOF_STATUSES.includes(status)) {
    throw new PaymentProofValidationError();
  }
  return status;
}

module.exports = { PAYMENT_PROOF_STATUSES, validatePaymentProofStatus };
