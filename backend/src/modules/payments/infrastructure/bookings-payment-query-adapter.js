const BookingPaymentQueryError = require('../domain/booking-payment-query-error');

const UPLOAD_PROOF = 'UPLOAD_PROOF';
const REVIEW_PAYMENT = 'REVIEW_PAYMENT';
const MIN_WINDOW_SECONDS = 180;
const MAX_WINDOW_SECONDS = 300;
const MILLISECONDS_PER_SECOND = 1000;
const SUPPORTED_STATUSES = Object.freeze(['PENDING_PAYMENT', 'EXPIRED']);

function isIdentifier(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateQuery(query) {
  if (
    !query ||
    typeof query !== 'object' ||
    Array.isArray(query) ||
    Object.keys(query).some((key) => !['bookingId', 'purpose'].includes(key)) ||
    !isIdentifier(query.bookingId) ||
    ![UPLOAD_PROOF, REVIEW_PAYMENT].includes(query.purpose)
  )
    throw new BookingPaymentQueryError('BOOKING_VALIDATION_ERROR');
  return Object.freeze({ bookingId: query.bookingId, purpose: query.purpose });
}

function projectContext(authContext, purpose) {
  if (
    !authContext ||
    typeof authContext !== 'object' ||
    Array.isArray(authContext) ||
    !isIdentifier(authContext.userId)
  )
    throw new BookingPaymentQueryError('UNAUTHENTICATED');
  const { userId, role, cooperativeId } = authContext;
  const customer = role === 'CUSTOMER' && cooperativeId === null && purpose === UPLOAD_PROOF;
  const clerk = role === 'CLERK' && isIdentifier(cooperativeId) && purpose === REVIEW_PAYMENT;
  if (!customer && !clerk) throw new BookingPaymentQueryError('FORBIDDEN');
  return Object.freeze({ userId, role, cooperativeId });
}

function integrityError() {
  return new BookingPaymentQueryError('BOOKING_DATA_INTEGRITY_ERROR');
}

function timestamp(value) {
  if (typeof value !== 'string') throw integrityError();
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) throw integrityError();
  return date.getTime();
}

function mapBooking(booking, query, context) {
  if (booking === null) return null;
  if (
    !booking ||
    typeof booking !== 'object' ||
    Array.isArray(booking) ||
    booking.bookingId !== query.bookingId ||
    !isIdentifier(booking.cooperativeId)
  )
    throw integrityError();
  if (query.purpose === UPLOAD_PROOF) {
    if (!isIdentifier(booking.ownerId)) throw integrityError();
    if (booking.ownerId !== context.userId) return null;
  } else if (booking.cooperativeId !== context.cooperativeId) return null;

  const { totalPriceCents, currency, status, proofWindowSeconds, canUploadProof } = booking;
  if (
    !Number.isSafeInteger(totalPriceCents) ||
    totalPriceCents < 0 ||
    currency !== 'USD' ||
    !SUPPORTED_STATUSES.includes(status) ||
    (status === 'EXPIRED' && canUploadProof !== false) ||
    typeof canUploadProof !== 'boolean' ||
    !Number.isInteger(proofWindowSeconds) ||
    proofWindowSeconds < MIN_WINDOW_SECONDS ||
    proofWindowSeconds > MAX_WINDOW_SECONDS
  )
    throw integrityError();
  timestamp(booking.createdAt);
  const start = timestamp(booking.proofWindowStartedAt);
  const deadline = timestamp(booking.expiresAt);
  const evaluated = timestamp(booking.evaluatedAt);
  if (
    deadline !== start + proofWindowSeconds * MILLISECONDS_PER_SECOND ||
    (canUploadProof && evaluated >= deadline)
  )
    throw integrityError();

  return Object.freeze({
    bookingId: booking.bookingId,
    cooperativeId: booking.cooperativeId,
    status,
    total: totalPriceCents,
    currency,
    createdAt: booking.createdAt,
    proofWindowStartedAt: booking.proofWindowStartedAt,
    proofWindowSeconds,
    expiresAt: booking.expiresAt,
    evaluatedAt: booking.evaluatedAt,
    acceptsPaymentProof: canUploadProof,
    ...(query.purpose === UPLOAD_PROOF ? { ownerId: booking.ownerId } : {}),
  });
}

/** Adaptador preparado para el contrato nuevo; aún no conectado a las rutas actuales. */
class BookingsPaymentQueryAdapter {
  constructor({ paymentQueries } = {}) {
    if (!paymentQueries || typeof paymentQueries.findForPayment !== 'function') {
      throw new TypeError(
        'Se requiere paymentQueries.findForPayment de la API pública de Bookings.',
      );
    }
    this.paymentQueries = paymentQueries;
  }

  async findForPayment(query, authContext) {
    const safeQuery = validateQuery(query);
    // El llamador debe provenir de Auth: comprobar la forma no autentica un principal.
    const context = projectContext(authContext, safeQuery.purpose);
    let booking;
    try {
      booking = await this.paymentQueries.findForPayment(safeQuery, context);
    } catch (error) {
      throw new BookingPaymentQueryError(error?.code);
    }
    return mapBooking(booking, safeQuery, context);
  }
}

module.exports = BookingsPaymentQueryAdapter;
