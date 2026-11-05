const { BookingValidationError } = require('./booking-error');
const BookingPaymentQueryError = require('./booking-payment-query-error');

function identifier(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function paymentReadRequest(query, context, { allowVerifiedGuest = false } = {}) {
  if (
    !query ||
    typeof query !== 'object' ||
    Array.isArray(query) ||
    Object.keys(query).some((key) => !['bookingId', 'purpose'].includes(key)) ||
    !identifier(query.bookingId) ||
    !['UPLOAD_PROOF', 'REVIEW_PAYMENT'].includes(query.purpose)
  ) {
    throw new BookingValidationError();
  }
  if (
    !context ||
    typeof context !== 'object' ||
    Array.isArray(context) ||
    !identifier(context.userId)
  )
    throw new BookingPaymentQueryError('UNAUTHENTICATED');
  const customer =
    context.role === 'CUSTOMER' &&
    context.cooperativeId === null &&
    query.purpose === 'UPLOAD_PROOF';
  const guest =
    allowVerifiedGuest &&
    context.role === 'GUEST_BUYER' &&
    context.cooperativeId === null &&
    query.purpose === 'UPLOAD_PROOF' &&
    context.userId.startsWith('guest:');
  const clerk =
    context.role === 'CLERK' &&
    identifier(context.cooperativeId) &&
    query.purpose === 'REVIEW_PAYMENT';
  if (!customer && !guest && !clerk) throw new BookingPaymentQueryError('FORBIDDEN');
  return Object.freeze({
    bookingId: query.bookingId,
    purpose: query.purpose,
    userId: context.userId,
    cooperativeId: customer || guest ? null : context.cooperativeId,
  });
}

function integrity() {
  throw new BookingPaymentQueryError('BOOKING_DATA_INTEGRITY_ERROR');
}

function timestamp(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) integrity();
  return value.getTime();
}

function cents(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[0-9]+$/.test(value)))
    integrity();
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) integrity();
  return amount;
}

function paymentBooking(row, request, now) {
  if (row === null) return null;
  if (
    !row ||
    row.id !== request.bookingId ||
    !identifier(row.owner_id) ||
    !identifier(row.cooperative_id)
  )
    integrity();
  // También se comprueba el filtro aplicado por el repositorio antes de revelar datos.
  if (
    (request.purpose === 'UPLOAD_PROOF' && row.owner_id !== request.userId) ||
    (request.purpose === 'REVIEW_PAYMENT' && row.cooperative_id !== request.cooperativeId)
  )
    return null;
  const total = cents(row.total_price_cents);
  if (
    row.currency !== 'USD' ||
    cents(row.summary_total) !== total ||
    !['PENDING_PAYMENT', 'EXPIRED'].includes(row.status)
  )
    integrity();
  const created = timestamp(row.created_at);
  const start = timestamp(row.proof_window_started_at);
  const deadline = timestamp(row.expires_at);
  if (
    !Number.isInteger(row.proof_window_seconds) ||
    row.proof_window_seconds < 180 ||
    row.proof_window_seconds > 300 ||
    deadline !== start + row.proof_window_seconds * 1000
  )
    integrity();
  const absent = row.proof_reception_state === 'NOT_RECEIVED';
  const received = row.proof_reception_state === 'RECEIVED';
  if (absent) {
    if (row.accepted_proof_id !== null || row.proof_received_at !== null) integrity();
  } else if (received) {
    if (!identifier(row.accepted_proof_id)) integrity();
    const accepted = timestamp(row.proof_received_at);
    if (accepted < start || accepted >= deadline) integrity();
  } else integrity();
  if (row.status === 'EXPIRED' && !absent) integrity();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new BookingPaymentQueryError();
  return Object.freeze({
    bookingId: row.id,
    cooperativeId: row.cooperative_id,
    status: row.status,
    totalPriceCents: total,
    currency: row.currency,
    createdAt: new Date(created).toISOString(),
    proofWindowStartedAt: new Date(start).toISOString(),
    proofWindowSeconds: row.proof_window_seconds,
    expiresAt: new Date(deadline).toISOString(),
    evaluatedAt: now.toISOString(),
    canUploadProof: row.status === 'PENDING_PAYMENT' && absent && now.getTime() < deadline,
    ...(request.purpose === 'UPLOAD_PROOF' ? { ownerId: row.owner_id } : {}),
  });
}
module.exports = { paymentReadRequest, paymentBooking };
