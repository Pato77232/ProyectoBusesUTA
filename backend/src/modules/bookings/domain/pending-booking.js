const { BookingValidationError } = require('./booking-error');
const { createBookingSummary } = require('./booking-summary');
const { createBookingDeadline } = require('./booking-deadline');
const BookingPurchaseError = require('./booking-purchase-error');

const INPUT_FIELDS = Object.freeze([
  'tripId',
  'fromPosition',
  'toPosition',
  'seatIds',
  'passengers',
  'summaryAccepted',
]);
const INITIAL_BOOKING_STATUS = 'PENDING_PAYMENT';

function identifier(value) {
  if (typeof value !== 'string' || !value.trim()) throw new BookingValidationError();
  return value.trim();
}

// Valor inicial privado; persistencia y bloqueo pertenecen a la futura transacción.
function createPendingBooking(input, context) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((field) => !INPUT_FIELDS.includes(field)) ||
    input.summaryAccepted !== true
  ) {
    throw new BookingValidationError();
  }
  const bookingId = identifier(context?.bookingId);
  const ownerId = identifier(context?.ownerId);
  const expiresAt = createBookingDeadline(context?.startedAt, context?.proofWindowSeconds);
  const { summaryAccepted, ...summaryInput } = input;
  const summary = createBookingSummary(summaryInput, context);
  if (summary.schemaVersion === 2 && summary.totals.totalPriceCents === 0) {
    throw new BookingPurchaseError('BOOKING_ZERO_TOTAL_UNSUPPORTED');
  }
  return Object.freeze({
    bookingId,
    ownerId,
    status: INITIAL_BOOKING_STATUS,
    summary,
    createdAt: context.startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}

module.exports = { createPendingBooking, INITIAL_BOOKING_STATUS };
