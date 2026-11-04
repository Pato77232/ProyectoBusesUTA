const { BookingValidationError } = require('../domain/booking-error');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createBookingOccupancyQueries({ pool }) {
  return Object.freeze({
    forTransaction(executor) {
      return createBookingOccupancyQueries({ pool: executor });
    },
    async hasActiveOccupations({ tripIds, cooperativeId } = {}) {
      if (
        typeof cooperativeId !== 'string' ||
        !UUID.test(cooperativeId) ||
        !Array.isArray(tripIds) ||
        tripIds.some((id) => typeof id !== 'string' || !UUID.test(id))
      ) {
        throw new BookingValidationError();
      }
      if (tripIds.length === 0) return false;
      const { rows } = await pool.query(
        `SELECT EXISTS (
          SELECT 1 FROM booking_seat_allocations
          WHERE cooperative_id = $1 AND trip_id = ANY($2::text[])
            AND active AND status IN ('RESERVED', 'SOLD')
        ) AS occupied`,
        [cooperativeId.toLowerCase(), [...new Set(tripIds.map((id) => id.toLowerCase()))]],
      );
      if (typeof rows[0]?.occupied !== 'boolean') {
        throw new TypeError('La consulta de ocupaciones debe devolver un booleano.');
      }
      return rows[0].occupied;
    },
  });
}

module.exports = createBookingOccupancyQueries;
