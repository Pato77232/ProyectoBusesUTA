const BookingCashError = require('../domain/booking-cash-error');

const fail = (code) => {
  throw new BookingCashError(code);
};
const UNIQUE_VIOLATION = '23505';

function result(row) {
  return Object.freeze({
    bookingId: row.id,
    status: 'SOLD',
    soldAt: new Date(row.sold_at).toISOString(),
    cashReceiptId: row.cash_receipt_id,
  });
}

/**
 * BOOK-CAJA-02: confirma el efectivo de una reserva de boletería. Bajo bloqueo exige la
 * misma cooperativa, estado pendiente, plazo vigente e importe exacto. Repetir el mismo
 * recibo devuelve el resultado guardado; otro recibo o importe es un conflicto.
 */
class PgCounterCashSales {
  constructor({ pool, clock = () => new Date() }) {
    this.pool = pool;
    this.clock = clock;
  }

  async confirmCash({ bookingId, cooperativeId, ownerId, actorId, cashReceiptId, amountCents }) {
    let client;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const { rows } = await client.query(
        `SELECT id,status,total_price_cents,expires_at,sold_at,cash_receipt_id
           FROM bookings WHERE id=$1 AND cooperative_id=$2 AND owner_id=$3 FOR UPDATE`,
        [bookingId, cooperativeId, ownerId],
      );
      const booking = rows[0];
      if (!booking) fail('BOOKING_CASH_NOT_FOUND');
      if (booking.status === 'SOLD') {
        if (
          booking.cash_receipt_id !== cashReceiptId ||
          Number(booking.total_price_cents) !== amountCents
        )
          fail('BOOKING_CASH_CONFLICT');
        await client.query('COMMIT');
        return result(booking);
      }
      if (booking.status === 'EXPIRED') fail('BOOKING_CASH_EXPIRED');
      if (booking.status !== 'PENDING_PAYMENT') fail('BOOKING_CASH_CONFLICT');
      if (Number(booking.total_price_cents) !== amountCents) fail('BOOKING_CASH_CONFLICT');
      const now = this.clock();
      if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('BOOKING_CASH_UNCERTAIN');
      if (new Date(booking.expires_at) <= now) fail('BOOKING_CASH_EXPIRED');
      const allocations = await client.query(
        `UPDATE booking_seat_allocations SET status='SOLD'
          WHERE booking_id=$1 AND cooperative_id=$2 AND active AND status='RESERVED'`,
        [bookingId, cooperativeId],
      );
      if (allocations.rowCount === 0) fail('BOOKING_CASH_CONFLICT');
      const sold = await client.query(
        `UPDATE bookings SET status='SOLD',sold_at=$3,sold_by=$4,cash_receipt_id=$5
          WHERE id=$1 AND cooperative_id=$2 AND status='PENDING_PAYMENT'
          RETURNING id,sold_at,cash_receipt_id`,
        [bookingId, cooperativeId, now, actorId, cashReceiptId],
      );
      if (sold.rowCount !== 1) fail('BOOKING_CASH_CONFLICT');
      await client.query('COMMIT');
      return result(sold.rows[0]);
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error instanceof BookingCashError) throw error;
      if (error?.code === UNIQUE_VIOLATION) throw new BookingCashError('BOOKING_CASH_CONFLICT');
      throw new BookingCashError('BOOKING_CASH_UNCERTAIN');
    } finally {
      client?.release();
    }
  }
}

module.exports = PgCounterCashSales;
