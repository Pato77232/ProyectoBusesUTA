const { frozenTrip } = require('./sold-booking-ticket');

const MAX_IDENTIFIER_LENGTH = 200;
const STATUSES = ['PENDING_PAYMENT', 'EXPIRED', 'REJECTED', 'SOLD'];
const MESSAGES = Object.freeze({
  BOOKING_NOTIFICATION_QUERY_INVALID: [400, 'Los datos de consulta del aviso no son válidos.'],
  BOOKING_NOTIFICATION_QUERY_UNAVAILABLE: [503, 'No se pudo consultar la reserva en este momento.'],
  BOOKING_NOTIFICATION_DATA_INTEGRITY_ERROR: [500, 'No se pudo verificar la reserva del aviso.'],
});

class BookingNotificationQueryError extends Error {
  constructor(code = 'BOOKING_NOTIFICATION_DATA_INTEGRITY_ERROR') {
    const safe = Object.hasOwn(MESSAGES, code) ? code : 'BOOKING_NOTIFICATION_DATA_INTEGRITY_ERROR';
    super(MESSAGES[safe][1]);
    this.name = 'BookingNotificationQueryError';
    this.code = safe;
    this.httpStatus = MESSAGES[safe][0];
  }
}

const identifier = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;

function notificationRequest(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== 2 ||
    !identifier(input.bookingId) ||
    !identifier(input.cooperativeId)
  )
    throw new BookingNotificationQueryError('BOOKING_NOTIFICATION_QUERY_INVALID');
  return Object.freeze({ bookingId: input.bookingId, cooperativeId: input.cooperativeId });
}

function optionalTrip(row, summary) {
  if (summary?.schemaVersion !== 2) return null;
  try {
    return frozenTrip(summary, {
      fromPosition: Number(row.fromPosition),
      toPosition: Number(row.toPosition),
    });
  } catch {
    return null;
  }
}

/**
 * Datos mínimos para redactar un aviso: propietario, estado, tramo congelado si existe y
 * nombres de pasajeros. No incluye cédulas, fechas de nacimiento ni comprobantes.
 */
function bookingNotificationContext(row, target) {
  if (row === null) return null;
  const fail = () => {
    throw new BookingNotificationQueryError();
  };
  if (
    !row ||
    row.bookingId !== target.bookingId ||
    row.cooperativeId !== target.cooperativeId ||
    !identifier(row.ownerId) ||
    !STATUSES.includes(row.status)
  )
    fail();
  const totalPriceCents = Number(row.totalPriceCents);
  const passengers = row.summary?.passengers;
  if (!Number.isSafeInteger(totalPriceCents) || totalPriceCents < 0 || !Array.isArray(passengers))
    fail();
  if (passengers.some((p) => typeof p?.fullName !== 'string' || !p.fullName.trim())) fail();
  return Object.freeze({
    bookingId: row.bookingId,
    cooperativeId: row.cooperativeId,
    ownerId: row.ownerId,
    status: row.status,
    currency: 'USD',
    totalPriceCents,
    trip: optionalTrip(row, row.summary),
    passengers: Object.freeze(passengers.map((p) => Object.freeze({ fullName: p.fullName }))),
  });
}

module.exports = { BookingNotificationQueryError, notificationRequest, bookingNotificationContext };
