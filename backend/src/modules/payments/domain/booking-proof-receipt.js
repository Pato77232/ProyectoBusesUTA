const {
  PaymentProofValidationError,
  PaymentProofUploadDeadlineExpiredError,
  BookingNotificationUncertainError,
} = require('./payment-proof-error');

const RECEIPT_FIELDS = Object.freeze(['bookingId', 'cooperativeId', 'paymentProofId']);
function receiptRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new PaymentProofValidationError();
  const copy = { ...input };
  if (
    Object.keys(copy).length !== RECEIPT_FIELDS.length ||
    Object.keys(copy).some((key) => !RECEIPT_FIELDS.includes(key)) ||
    RECEIPT_FIELDS.some((key) => typeof copy[key] !== 'string' || !copy[key].trim())
  )
    throw new PaymentProofValidationError();
  return Object.freeze(Object.fromEntries(RECEIPT_FIELDS.map((key) => [key, copy[key]])));
}
function receiptResult(result, request) {
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new BookingNotificationUncertainError();
  const copy = { ...result };
  const timeKey = copy.outcome === 'ACCEPTED' ? 'acceptedAt' : 'rejectedAt';
  const value = copy[timeKey];
  const time = typeof value === 'string' ? new Date(value) : null;
  const allowed = [...RECEIPT_FIELDS, 'outcome', timeKey];
  if (
    !['ACCEPTED', 'REJECTED_EXPIRED'].includes(copy.outcome) ||
    Object.keys(copy).length !== allowed.length ||
    Object.keys(copy).some((key) => !allowed.includes(key)) ||
    RECEIPT_FIELDS.some((key) => copy[key] !== request[key]) ||
    !time ||
    !Number.isFinite(time.getTime()) ||
    time.toISOString() !== value
  )
    throw new BookingNotificationUncertainError();
  return Object.freeze(copy);
}
function acknowledgeReceipt(result, request) {
  const copy = receiptResult(result, request);
  if (copy.outcome === 'REJECTED_EXPIRED') throw new PaymentProofUploadDeadlineExpiredError();
  return copy;
}
module.exports = { receiptRequest, receiptResult, acknowledgeReceipt };
