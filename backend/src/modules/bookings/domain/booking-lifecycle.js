const { BookingValidationError } = require('./booking-error');
const BookingLifecycleError = require('./booking-lifecycle-error');
const id = (value) => typeof value === 'string' && value.trim().length > 0;
const fail = (code = 'BOOKING_DATA_INTEGRITY_ERROR') => {
  throw new BookingLifecycleError(code);
};
function request(input, receipt = true) {
  const fields = receipt ? ['bookingId', 'cooperativeId', 'paymentProofId'] : ['bookingId'];
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== fields.length ||
    Object.keys(input).some((key) => !fields.includes(key)) ||
    fields.some((key) => !id(input[key]))
  )
    throw new BookingValidationError();
  return Object.freeze(Object.fromEntries(fields.map((key) => [key, input[key]])));
}
function verifiedSource(source, target) {
  const date = typeof source?.uploadedAt === 'string' ? new Date(source.uploadedAt) : null;
  if (
    !source ||
    ['bookingId', 'cooperativeId', 'paymentProofId'].some((key) => source[key] !== target[key]) ||
    source.status !== 'UPLOADED' ||
    source.notificationStatus !== 'PENDING' ||
    !date ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString() !== source.uploadedAt
  ) {
    fail('BOOKING_RECEIPT_SOURCE_MISMATCH');
  }
}
function timestamp(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) fail();
  return value.getTime();
}
function receiptResult(row, target) {
  if (!row) return null;
  if (['bookingId', 'cooperativeId', 'paymentProofId'].some((key) => row[key] !== target[key])) {
    fail('BOOKING_RECEIPT_LINK_MISMATCH');
  }
  if (!['ACCEPTED', 'REJECTED_EXPIRED'].includes(row.outcome)) fail();
  const at = new Date(timestamp(row.decidedAt)).toISOString();
  return Object.freeze({
    ...target,
    outcome: row.outcome,
    ...(row.outcome === 'ACCEPTED' ? { acceptedAt: at } : { rejectedAt: at }),
  });
}
function inspect(booking, allocations) {
  if (
    !booking ||
    !id(booking.bookingId) ||
    !id(booking.cooperativeId) ||
    !id(booking.tripId) ||
    !['PENDING_PAYMENT', 'EXPIRED', 'CONFIRMED'].includes(booking.status) ||
    !['NOT_RECEIVED', 'RECEIVED'].includes(booking.proofReceptionState) ||
    !Number.isSafeInteger(booking.fromPosition) ||
    !Number.isSafeInteger(booking.toPosition) ||
    booking.fromPosition < 0 ||
    booking.toPosition <= booking.fromPosition ||
    !Number.isInteger(booking.proofWindowSeconds) ||
    booking.proofWindowSeconds < 180 ||
    booking.proofWindowSeconds > 300
  )
    fail();
  const start = timestamp(booking.proofWindowStartedAt);
  const deadline = timestamp(booking.expiresAt);
  if (deadline !== start + booking.proofWindowSeconds * 1000) fail();
  if (booking.proofReceptionState === 'RECEIVED') {
    const received = timestamp(booking.proofReceivedAt);
    if (!id(booking.acceptedProofId) || received < start || received >= deadline) fail();
  } else if (booking.acceptedProofId !== null || booking.proofReceivedAt !== null) fail();
  const confirmed = booking.status === 'CONFIRMED';
  if (
    confirmed &&
    (booking.proofReceptionState !== 'RECEIVED' ||
      timestamp(booking.confirmedAt) < timestamp(booking.proofReceivedAt))
  )
    fail();
  if (!confirmed && booking.confirmedAt !== null && booking.confirmedAt !== undefined) fail();
  const expired = booking.status === 'EXPIRED';
  if (expired) {
    if (booking.proofReceptionState !== 'NOT_RECEIVED' || timestamp(booking.expiredAt) < deadline)
      fail();
  } else if (booking.expiredAt !== null) fail();
  if (
    !Array.isArray(allocations) ||
    !Number.isInteger(booking.passengerCount) ||
    booking.passengerCount < 1 ||
    allocations.length !== booking.passengerCount ||
    allocations.some(
      (seat) =>
        seat.status !== (confirmed ? 'SOLD' : 'RESERVED') ||
        seat.active !== !expired ||
        seat.fromPosition !== booking.fromPosition ||
        seat.toPosition !== booking.toPosition,
    )
  )
    fail();
  return { start, deadline, expired };
}
function expireDecision(booking, allocations, now) {
  const { start, deadline, expired } = inspect(booking, allocations);
  if (expired)
    return Object.freeze({
      outcome: 'EXPIRED',
      bookingId: booking.bookingId,
      expiredAt: booking.expiredAt.toISOString(),
    });
  if (booking.proofReceptionState === 'RECEIVED')
    return Object.freeze({ outcome: 'PROOF_RECEIVED', bookingId: booking.bookingId });
  const evaluated = timestamp(now);
  if (evaluated < start) fail();
  if (evaluated < deadline)
    return Object.freeze({ outcome: 'NOT_DUE', bookingId: booking.bookingId });
  return Object.freeze({
    outcome: 'EXPIRED',
    bookingId: booking.bookingId,
    expiredAt: new Date(evaluated).toISOString(),
  });
}
function receiveDecision(booking, allocations, target, now) {
  if (booking.cooperativeId !== target.cooperativeId || booking.bookingId !== target.bookingId)
    fail('BOOKING_RECEIPT_LINK_MISMATCH');
  const { start, deadline, expired } = inspect(booking, allocations);
  if (booking.proofReceptionState === 'RECEIVED') fail('BOOKING_RECEIPT_LINK_MISMATCH');
  const evaluated = timestamp(now);
  if (evaluated < start) fail();
  return receiptResult(
    {
      ...target,
      outcome: expired || evaluated >= deadline ? 'REJECTED_EXPIRED' : 'ACCEPTED',
      decidedAt: new Date(evaluated),
    },
    target,
  );
}
module.exports = {
  request,
  verifiedSource,
  receiptResult,
  expireDecision,
  receiveDecision,
  inspect,
};
