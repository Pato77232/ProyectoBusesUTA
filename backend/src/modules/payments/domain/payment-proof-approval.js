const {
  PaymentProofValidationError,
  PaymentProofNotPendingError,
} = require('./payment-proof-error');

function approvePaymentProof(paymentProof, approverId, approvedAt) {
  if (!paymentProof || typeof paymentProof !== 'object' || Array.isArray(paymentProof)) {
    throw new PaymentProofValidationError();
  }
  if (typeof approverId !== 'string' || !approverId.trim()) {
    throw new PaymentProofValidationError();
  }

  const decisionDate =
    approvedAt instanceof Date ? new Date(approvedAt.getTime()) : new Date(approvedAt);
  if (Number.isNaN(decisionDate.getTime())) throw new PaymentProofValidationError();

  if (paymentProof.approved_at && paymentProof.approved_by) return paymentProof;
  if (paymentProof.status !== 'UPLOADED') throw new PaymentProofNotPendingError();

  return Object.freeze({
    ...paymentProof,
    approved_at: decisionDate,
    approved_by: approverId.trim(),
  });
}

module.exports = { approvePaymentProof };
