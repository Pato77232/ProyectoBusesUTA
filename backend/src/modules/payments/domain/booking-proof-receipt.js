const {
  PaymentProofValidationError,
  PaymentProofUploadDeadlineExpiredError,
  BookingNotificationUncertainError,
} = require('./payment-proof-error');

const RECEIPT_FIELDS = Object.freeze(['bookingId', 'cooperativeId', 'paymentProofId']);
function receiptRequest(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== RECEIPT_FIELDS.length ||
    Object.keys(input).some((key) => !RECEIPT_FIELDS.includes(key)) ||
    RECEIPT_FIELDS.some((key) => typeof input[key] !== 'string' || !input[key].trim())
  )
    throw new PaymentProofValidationError();
  return Object.freeze(Object.fromEntries(RECEIPT_FIELDS.map((key) => [key, input[key]])));
}
function acknowledgeReceipt(result, request) {
  const timeKey = result?.outcome === 'ACCEPTED' ? 'acceptedAt' : 'rejectedAt';
  const time = typeof result?.[timeKey] === 'string' ? new Date(result[timeKey]) : null;
  const allowed = [...RECEIPT_FIELDS, 'outcome', timeKey];
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    !['ACCEPTED', 'REJECTED_EXPIRED'].includes(result.outcome) ||
    Object.keys(result).length !== allowed.length ||
    Object.keys(result).some((key) => !allowed.includes(key)) ||
    RECEIPT_FIELDS.some((key) => result[key] !== request[key]) ||
    !time ||
    !Number.isFinite(time.getTime()) ||
    time.toISOString() !== result[timeKey]
  )
    throw new BookingNotificationUncertainError();
  if (result.outcome === 'REJECTED_EXPIRED') throw new PaymentProofUploadDeadlineExpiredError();
}
module.exports = { receiptRequest, acknowledgeReceipt };
