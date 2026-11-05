const ErrorType = require('./booking-ticket-error');
function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
function request(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== 2 ||
    !['bookingId', 'cooperativeId'].every(
      (key) => Object.hasOwn(input, key) && nonEmpty(input[key]),
    )
  )
    throw new ErrorType('BOOKING_TICKET_QUERY_INVALID');
  return Object.freeze({ bookingId: input.bookingId, cooperativeId: input.cooperativeId });
}
function assert(condition) {
  if (!condition) throw new ErrorType();
}
function integer(value) {
  assert(
    typeof value === 'number' || (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)),
  );
  const result = Number(value);
  assert(Number.isSafeInteger(result) && result >= 0);
  return result;
}
function soldDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  assert((value instanceof Date || typeof value === 'string') && Number.isFinite(date.getTime()));
  const result = date.toISOString();
  assert(value instanceof Date || value === result);
  return result;
}
function passengersFor(summary, allocations, scope) {
  assert(
    Array.isArray(summary.passengers) &&
      summary.passengers.length > 0 &&
      Array.isArray(allocations) &&
      allocations.length === summary.passengers.length,
  );
  const seats = new Map();
  for (const allocation of allocations) {
    assert(
      allocation &&
        nonEmpty(allocation.seatId) &&
        !seats.has(allocation.seatId) &&
        allocation.bookingId === scope.bookingId &&
        allocation.cooperativeId === scope.cooperativeId &&
        allocation.tripId === scope.tripId &&
        allocation.status === 'SOLD' &&
        integer(allocation.fromPosition) === scope.fromPosition &&
        integer(allocation.toPosition) === scope.toPosition,
    );
    seats.set(allocation.seatId, true);
  }
  return Object.freeze(
    Array.from(summary.passengers, (passenger) => {
      assert(
        passenger &&
          nonEmpty(passenger.seatId) &&
          seats.delete(passenger.seatId) &&
          nonEmpty(passenger.fullName) &&
          typeof passenger.identificationNumber === 'string' &&
          /^[0-9]{10}$/.test(passenger.identificationNumber) &&
          Number.isSafeInteger(passenger.quote?.totalPriceCents) &&
          passenger.quote.totalPriceCents >= 0,
      );
      return Object.freeze({
        seatId: passenger.seatId,
        fullName: passenger.fullName,
        identificationNumber: passenger.identificationNumber,
        totalPriceCents: passenger.quote.totalPriceCents,
      });
    }),
  );
}
function soldBookingTicket(row, target) {
  if (row === null) return null;
  assert(row && row.bookingId === target.bookingId && row.cooperativeId === target.cooperativeId);
  assert(['PENDING_PAYMENT', 'EXPIRED', 'REJECTED', 'SOLD'].includes(row.status));
  if (row.status !== 'SOLD') return null;
  const fromPosition = integer(row.fromPosition);
  const toPosition = integer(row.toPosition);
  assert(nonEmpty(row.tripId) && fromPosition < toPosition);
  const summary = row.summary;
  assert(
    summary &&
      summary.schemaVersion === 2 &&
      summary.currency === 'USD' &&
      summary.tripId === row.tripId &&
      summary.cooperativeId === row.cooperativeId &&
      summary.fromPosition === fromPosition &&
      summary.toPosition === toPosition,
  );
  const totalPriceCents = integer(row.totalPriceCents);
  assert(
    Number.isSafeInteger(summary.totals?.totalPriceCents) &&
      summary.totals.totalPriceCents === totalPriceCents,
  );
  const scope = { ...target, tripId: row.tripId, fromPosition, toPosition };
  const passengers = passengersFor(summary, row.allocations, scope);
  const sum = passengers.reduce((amount, p) => amount + BigInt(p.totalPriceCents), 0n);
  assert(sum === BigInt(totalPriceCents));
  return Object.freeze({
    ...scope,
    soldAt: soldDate(row.soldAt),
    currency: 'USD',
    totalPriceCents,
    passengers,
  });
}
module.exports = { request, soldBookingTicket };
