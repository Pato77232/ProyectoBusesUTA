const {
  BookingNotificationQueryError,
  notificationRequest,
  bookingNotificationContext,
} = require('../domain/booking-notification-context');

const TEMPORARY = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  '57P01',
  '57P02',
  '57P03',
  '40001',
  '40P01',
  '53300',
]);

/** Lectura pública de Reservas para el módulo de avisos; nunca se expone por HTTP. */
module.exports = function createBookingNotificationQueries({ pool } = {}) {
  if (typeof pool?.query !== 'function')
    throw new TypeError('Se requiere una conexión de Reservas.');
  return Object.freeze({
    async findNotificationContext(input) {
      const target = notificationRequest(input);
      try {
        const { rows } = await pool.query(
          `SELECT id AS "bookingId", cooperative_id AS "cooperativeId", owner_id AS "ownerId",
             status, from_position AS "fromPosition", to_position AS "toPosition",
             total_price_cents AS "totalPriceCents", summary
           FROM bookings WHERE id=$1 AND cooperative_id=$2`,
          [target.bookingId, target.cooperativeId],
        );
        if (rows.length > 1) throw new BookingNotificationQueryError();
        return bookingNotificationContext(rows[0] ?? null, target);
      } catch (error) {
        if (error instanceof BookingNotificationQueryError) throw error;
        throw new BookingNotificationQueryError(
          TEMPORARY.has(error?.code) ? 'BOOKING_NOTIFICATION_QUERY_UNAVAILABLE' : undefined,
        );
      }
    },
  });
};
