const BookingSaleError = require('../domain/booking-sale-error');
const { inspect } = require('../domain/booking-lifecycle');
const { recoverSaleResult } = require('../domain/booking-sale-attempt');
const fail = (code) => {
  throw new BookingSaleError(code);
};
function storedSale(row) {
  return {
    bookingId: row.id,
    cooperativeId: row.cooperative_id,
    paymentProofId: row.accepted_proof_id,
    proofVersion: Number(row.sale_proof_version),
    requestedBy: row.sale_requested_by,
    requestedAt: row.sale_requested_at.toISOString(),
    confirmedAt: row.confirmed_at.toISOString(),
    currency: row.summary.currency,
    totalPriceCents: Number(row.total_price_cents),
  };
}
function validateSummary(booking, allocations) {
  const row = booking.row;
  const summary = row.summary;
  if (
    !Array.isArray(summary?.passengers) ||
    summary.passengers.some((p) => !p || typeof p.seatId !== 'string' || !p.seatId.trim())
  )
    fail();
  const expected = summary.passengers.map((p) => p.seatId);
  if (
    !expected ||
    new Set(expected).size !== expected.length ||
    summary.currency !== 'USD' ||
    summary.tripId !== booking.tripId ||
    summary.cooperativeId !== booking.cooperativeId ||
    summary.fromPosition !== booking.fromPosition ||
    summary.toPosition !== booking.toPosition ||
    !Number.isSafeInteger(Number(row.total_price_cents)) ||
    Number(row.total_price_cents) <= 0 ||
    summary.totals?.totalPriceCents !== Number(row.total_price_cents) ||
    summary.totals?.basePriceCents !== Number(row.base_price_cents) ||
    summary.totals?.discountCents !== Number(row.discount_cents) ||
    allocations.some(
      (seat) =>
        !expected.includes(seat.seatId) ||
        seat.bookingId !== booking.bookingId ||
        seat.cooperativeId !== booking.cooperativeId ||
        seat.tripId !== booking.tripId,
    )
  )
    fail();
}
async function persistSale(client, attempt, booking, allocations, clock) {
  if (booking.bookingId !== attempt.bookingId || booking.cooperativeId !== attempt.cooperativeId)
    fail('BOOKING_SALE_LINK_MISMATCH');
  if (
    !['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status) ||
    booking.proofReceptionState !== 'RECEIVED'
  )
    fail('BOOKING_SALE_NOT_CONFIRMABLE');
  if (booking.acceptedProofId !== attempt.paymentProofId) fail('BOOKING_SALE_LINK_MISMATCH');
  inspect(booking, allocations);
  validateSummary(booking, allocations);
  const {
    rows: [receipt],
  } = await client.query('SELECT * FROM booking_proof_receipt_results WHERE payment_proof_id=$1', [
    attempt.paymentProofId,
  ]);
  if (
    !receipt ||
    receipt.outcome !== 'ACCEPTED' ||
    receipt.booking_id !== attempt.bookingId ||
    receipt.cooperative_id !== attempt.cooperativeId ||
    receipt.trip_id !== booking.tripId ||
    receipt.decided_at.getTime() !== booking.proofReceivedAt.getTime()
  )
    fail();
  if (booking.status === 'CONFIRMED') return recoverSaleResult(attempt, storedSale(booking.row));
  const at = clock();
  if (!(at instanceof Date) || !Number.isFinite(at.getTime()) || at < booking.proofReceivedAt)
    fail();
  const result = recoverSaleResult(attempt, {
    ...attempt,
    currency: 'USD',
    totalPriceCents: Number(booking.row.total_price_cents),
    confirmedAt: at.toISOString(),
  });
  // Actualizar cada asiento permite detectar un fallo parcial y revertir toda la operación.
  for (const seat of allocations) {
    const updated = await client.query(
      "UPDATE booking_seat_allocations SET status='SOLD' WHERE booking_id=$1 AND seat_id=$2 AND status='RESERVED' AND active RETURNING seat_id",
      [attempt.bookingId, seat.seatId],
    );
    if (updated.rowCount !== 1) fail();
  }
  const updated = await client.query(
    `UPDATE bookings SET status='CONFIRMED',sale_proof_version=$2,
    sale_requested_by=$3,sale_requested_at=$4,confirmed_at=$5 WHERE id=$1 AND status='PENDING_PAYMENT' RETURNING id`,
    [
      attempt.bookingId,
      attempt.proofVersion,
      attempt.requestedBy,
      attempt.requestedAt,
      result.confirmedAt,
    ],
  );
  if (updated.rowCount !== 1) fail();
  return result;
}
module.exports = { persistSale };
