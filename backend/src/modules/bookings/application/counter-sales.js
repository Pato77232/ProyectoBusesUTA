const getBookingSummary = require('./get-booking-summary.use-case');
const createBooking = require('./create-booking.use-case');
const { BookingValidationError } = require('../domain/booking-error');
const BookingAccessError = require('../domain/booking-access-error');
const BookingTripUnavailableError = require('../domain/booking-trip-unavailable-error');
const BookingCashError = require('../domain/booking-cash-error');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECEIPT = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_ID_LENGTH = 200;
const DECISION_FIELDS = Object.freeze(['seatId', 'birthDateVerified', 'disabilityVerified']);

/** Oficinista verificado por la sesión; nunca se lee la cooperativa del body. */
function counterClerk(context) {
  const user = context?.user;
  if (typeof context?.sid !== 'string' || !context.sid.trim() || !UUID.test(user?.id ?? ''))
    throw new BookingAccessError();
  if (user.role !== 'CLERK' || !UUID.test(user.cooperative_id ?? ''))
    throw new BookingAccessError('FORBIDDEN');
  const cooperativeId = user.cooperative_id.toLowerCase();
  return Object.freeze({
    actorId: user.id,
    cooperativeId,
    ownerId: `counter:${cooperativeId}`,
  });
}

function splitDecisions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BookingValidationError();
  const { decisions, ...purchase } = input;
  if (
    !Array.isArray(decisions) ||
    decisions.some(
      (decision) =>
        !decision ||
        typeof decision !== 'object' ||
        Object.keys(decision).some((key) => !DECISION_FIELDS.includes(key)) ||
        typeof decision.seatId !== 'string' ||
        typeof decision.birthDateVerified !== 'boolean' ||
        typeof decision.disabilityVerified !== 'boolean',
    )
  )
    throw new BookingValidationError();
  return { purchase, decisions: Object.freeze(decisions.map((d) => Object.freeze({ ...d }))) };
}

/**
 * En boletería el oficinista acredita en el mismo paso, con el documento a la vista.
 * Este verificador además impide cotizar viajes de otra cooperativa.
 */
function counterVerifier(clerk, decisions) {
  return Object.freeze({
    async verify(input) {
      if (input?.cooperativeId !== clerk.cooperativeId) throw new BookingTripUnavailableError();
      return decisions;
    },
  });
}

function cashInput(bookingId, body) {
  if (
    typeof bookingId !== 'string' ||
    !bookingId.trim() ||
    bookingId.length > MAX_ID_LENGTH ||
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !['cashReceiptId', 'amountCents'].includes(key)) ||
    typeof body.cashReceiptId !== 'string' ||
    !RECEIPT.test(body.cashReceiptId) ||
    !Number.isSafeInteger(body.amountCents) ||
    body.amountCents <= 0
  )
    throw new BookingValidationError();
  return Object.freeze({
    bookingId,
    cashReceiptId: body.cashReceiptId,
    amountCents: body.amountCents,
  });
}

/** BOOK-CAJA-02: venta en boletería sin cuenta del comprador (opción A, sin autocompletado). */
function createCounterSales({ dependencies, cashSales }) {
  if (typeof cashSales?.confirmCash !== 'function')
    throw new TypeError('Falta el registro de cobros en efectivo.');
  const withClerk = (clerk, decisions) => ({
    ...dependencies,
    buyerIdentity: { resolve: async () => ({ ownerId: clerk.ownerId }) },
    passengerVerifier: counterVerifier(clerk, decisions),
  });
  return Object.freeze({
    async summary(input, context) {
      const clerk = counterClerk(context);
      const { purchase, decisions } = splitDecisions(input);
      return getBookingSummary(withClerk(clerk, decisions))(purchase, context);
    },
    async create(input, context) {
      const clerk = counterClerk(context);
      const { purchase, decisions } = splitDecisions(input);
      return createBooking(withClerk(clerk, decisions))(purchase, context);
    },
    async confirmCash(bookingId, body, context) {
      const clerk = counterClerk(context);
      const cash = cashInput(bookingId, body);
      try {
        return await cashSales.confirmCash({ ...cash, ...clerk });
      } catch (error) {
        if (error instanceof BookingCashError) throw error;
        throw new BookingCashError('BOOKING_CASH_UNCERTAIN');
      }
    },
  });
}

module.exports = { createCounterSales, counterClerk };
