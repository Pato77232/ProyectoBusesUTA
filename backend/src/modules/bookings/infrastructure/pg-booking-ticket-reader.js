class PgBookingTicketReader {
  constructor({ pool }) {
    if (typeof pool?.query !== 'function')
      throw new TypeError('Se requiere una conexión de Reservas.');
    this.pool = pool;
  }
  async findSoldCandidate({ bookingId, cooperativeId }) {
    const { rows } = await this.pool.query(
      `SELECT b.id AS "bookingId", b.cooperative_id AS "cooperativeId", b.trip_id AS "tripId",
        b.from_position AS "fromPosition", b.to_position AS "toPosition", b.status,
        b.total_price_cents AS "totalPriceCents", b.sold_at AS "soldAt", b.summary,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'bookingId', a.booking_id, 'cooperativeId', a.cooperative_id, 'tripId', a.trip_id,
          'seatId', a.seat_id, 'fromPosition', a.from_position, 'toPosition', a.to_position,
          'status', a.status) ORDER BY a.seat_id)
        FROM booking_seat_allocations a WHERE a.booking_id=b.id
          AND a.cooperative_id=b.cooperative_id AND a.trip_id=b.trip_id AND a.active), '[]'::jsonb)
          AS allocations
       FROM bookings b WHERE b.id=$1 AND b.cooperative_id=$2`,
      [bookingId, cooperativeId],
    );
    if (rows.length > 1) throw new TypeError('La lectura de venta no es única.');
    return rows.length === 0 ? null : rows[0];
  }
}
module.exports = PgBookingTicketReader;
