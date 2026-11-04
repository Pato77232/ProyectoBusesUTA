const BookingLifecycleError = require('../domain/booking-lifecycle-error');

const fail = (code) => {
  throw new BookingLifecycleError(code);
};

function required(value) {
  if (typeof value !== 'string' || !value.trim()) fail('BOOKING_SALE_REJECTED');
  return value.trim();
}

class PgBookingSaleConfirmer {
  constructor({ pool, clock = () => new Date() }) {
    this.pool = pool;
    this.clock = clock;
  }

  async confirmSale({ bookingId, cooperativeId, paymentProofId } = {}) {
    const id = required(bookingId);
    const tenantId = required(cooperativeId);
    const proofId = required(paymentProofId);
    let client;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const { rows } = await client.query(
        `SELECT id,cooperative_id,status,proof_reception_state,accepted_proof_id
           FROM bookings WHERE id=$1 AND cooperative_id=$2 FOR UPDATE`,
        [id, tenantId],
      );
      const booking = rows[0];
      if (!booking) fail('BOOKING_SALE_REJECTED');
      if (booking.status === 'SOLD' && booking.accepted_proof_id === proofId) {
        await client.query('COMMIT');
        return true;
      }
      if (
        booking.status !== 'PENDING_PAYMENT' ||
        booking.proof_reception_state !== 'RECEIVED' ||
        booking.accepted_proof_id !== proofId
      )
        fail('BOOKING_SALE_REJECTED');
      const now = this.clock();
      if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('BOOKING_SALE_UNCERTAIN');
      await client.query(
        `UPDATE booking_seat_allocations
            SET status='SOLD'
          WHERE booking_id=$1 AND cooperative_id=$2 AND active AND status='RESERVED'`,
        [id, tenantId],
      );
      await client.query(
        `UPDATE bookings SET status='SOLD',sold_at=$3
          WHERE id=$1 AND cooperative_id=$2 AND status='PENDING_PAYMENT'`,
        [id, tenantId, now],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error instanceof BookingLifecycleError) throw error;
      throw new BookingLifecycleError('BOOKING_SALE_UNCERTAIN');
    } finally {
      client?.release();
    }
  }

  async rejectSale({ bookingId, cooperativeId, paymentProofId, rejectedBy, justification } = {}) {
    const id = required(bookingId);
    const tenantId = required(cooperativeId);
    const proofId = required(paymentProofId);
    const actor = required(rejectedBy);
    if (typeof justification !== 'string' || !justification.trim()) fail('BOOKING_SALE_REJECTED');
    let client;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const { rows } = await client.query(
        `SELECT id,cooperative_id,status,proof_reception_state,accepted_proof_id
           FROM bookings WHERE id=$1 AND cooperative_id=$2 FOR UPDATE`,
        [id, tenantId],
      );
      const booking = rows[0];
      if (!booking) fail('BOOKING_SALE_REJECTED');
      if (booking.status === 'REJECTED' && booking.accepted_proof_id === proofId) {
        await client.query('COMMIT');
        return true;
      }
      if (
        booking.status !== 'PENDING_PAYMENT' ||
        booking.proof_reception_state !== 'RECEIVED' ||
        booking.accepted_proof_id !== proofId
      )
        fail('BOOKING_SALE_REJECTED');
      const now = this.clock();
      if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('BOOKING_SALE_UNCERTAIN');
      await client.query(
        `UPDATE booking_seat_allocations SET active=false
          WHERE booking_id=$1 AND cooperative_id=$2 AND status='RESERVED' AND active`,
        [id, tenantId],
      );
      await client.query(
        `UPDATE bookings SET status='REJECTED',rejected_at=$3,rejected_by=$4,rejection_justification=$5
          WHERE id=$1 AND cooperative_id=$2 AND status='PENDING_PAYMENT'`,
        [id, tenantId, now, actor, justification.trim()],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error instanceof BookingLifecycleError) throw error;
      throw new BookingLifecycleError('BOOKING_SALE_UNCERTAIN');
    } finally {
      client?.release();
    }
  }
}

module.exports = PgBookingSaleConfirmer;
