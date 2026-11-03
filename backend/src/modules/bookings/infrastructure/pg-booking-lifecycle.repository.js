const BookingLifecycleError = require('../domain/booking-lifecycle-error');
const { receiptResult, expireDecision, receiveDecision } = require('../domain/booking-lifecycle');
const fail = (code) => {
  throw new BookingLifecycleError(code);
};
function snapshot(row) {
  return {
    bookingId: row.id,
    cooperativeId: row.cooperative_id,
    tripId: row.trip_id,
    status: row.status,
    fromPosition: Number(row.from_position),
    toPosition: Number(row.to_position),
    proofWindowStartedAt: row.proof_window_started_at,
    proofWindowSeconds: row.proof_window_seconds,
    expiresAt: row.expires_at,
    expiredAt: row.expired_at,
    proofReceptionState: row.proof_reception_state,
    acceptedProofId: row.accepted_proof_id,
    proofReceivedAt: row.proof_received_at,
    passengerCount: Array.isArray(row.summary?.passengers) ? row.summary.passengers.length : null,
  };
}
async function prior(client, target) {
  const { rows } = await client.query(
    'SELECT * FROM booking_proof_receipt_results WHERE payment_proof_id=$1',
    [target.paymentProofId],
  );
  const row = rows[0];
  return receiptResult(
    row
      ? {
          bookingId: row.booking_id,
          cooperativeId: row.cooperative_id,
          paymentProofId: row.payment_proof_id,
          outcome: row.outcome,
          decidedAt: row.decided_at,
        }
      : null,
    target,
  );
}
async function lockedBooking(client, bookingId) {
  const {
    rows: [scope],
  } = await client.query('SELECT cooperative_id,trip_id FROM bookings WHERE id=$1', [bookingId]);
  if (!scope) fail('BOOKING_NOT_FOUND');
  await client.query(
    'SELECT trip_id FROM booking_trip_locks WHERE cooperative_id=$1 AND trip_id=$2 FOR UPDATE',
    [scope.cooperative_id, scope.trip_id],
  );
  const {
    rows: [row],
  } = await client.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [bookingId]);
  if (!row || row.cooperative_id !== scope.cooperative_id || row.trip_id !== scope.trip_id)
    fail('BOOKING_DATA_INTEGRITY_ERROR');
  const { rows } = await client.query(
    'SELECT status,active,from_position,to_position FROM booking_seat_allocations WHERE booking_id=$1 ORDER BY seat_id FOR UPDATE',
    [bookingId],
  );
  return {
    booking: snapshot(row),
    allocations: rows.map((seat) => ({
      status: seat.status,
      active: seat.active,
      fromPosition: Number(seat.from_position),
      toPosition: Number(seat.to_position),
    })),
  };
}
async function expire(client, booking, at) {
  if (booking.status === 'EXPIRED') return;
  await client.query(
    "UPDATE booking_seat_allocations SET active=false WHERE booking_id=$1 AND status='RESERVED' AND active",
    [booking.bookingId],
  );
  await client.query("UPDATE bookings SET status='EXPIRED',expired_at=$2 WHERE id=$1", [
    booking.bookingId,
    at,
  ]);
}
function safe(error) {
  if (error instanceof BookingLifecycleError) return error;
  return new BookingLifecycleError(
    ['23503', '23505', '23514'].includes(error.code)
      ? 'BOOKING_DATA_INTEGRITY_ERROR'
      : 'BOOKING_LIFECYCLE_UNAVAILABLE',
  );
}
class PgBookingLifecycleRepository {
  constructor({ pool }) {
    this.pool = pool;
  }
  async transaction(execute) {
    let client, connectionFailure;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const result = await execute(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (client)
        try {
          await client.query('ROLLBACK');
        } catch (failure) {
          connectionFailure = failure;
        }
      throw safe(error);
    } finally {
      if (client) client.release(connectionFailure);
    }
  }
  async findReceipt(target) {
    try {
      return await prior(this.pool, target);
    } catch (error) {
      throw safe(error);
    }
  }
  async receive(target, clock) {
    return this.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        JSON.stringify(['booking-proof-receipt', target.paymentProofId]),
      ]);
      const previous = await prior(client, target);
      if (previous) return previous;
      const { booking, allocations } = await lockedBooking(client, target.bookingId);
      const result = receiveDecision(booking, allocations, target, clock());
      const at = result.acceptedAt || result.rejectedAt;
      if (result.outcome === 'ACCEPTED') {
        await client.query(
          "UPDATE bookings SET proof_reception_state='RECEIVED',accepted_proof_id=$2,proof_received_at=$3 WHERE id=$1",
          [target.bookingId, target.paymentProofId, at],
        );
      } else await expire(client, booking, at);
      await client.query(
        `INSERT INTO booking_proof_receipt_results(payment_proof_id,booking_id,cooperative_id,trip_id,outcome,decided_at)
        VALUES($1,$2,$3,$4,$5,$6)`,
        [
          target.paymentProofId,
          target.bookingId,
          target.cooperativeId,
          booking.tripId,
          result.outcome,
          at,
        ],
      );
      return result;
    });
  }
  async expire(target, clock) {
    return this.transaction(async (client) => {
      const { booking, allocations } = await lockedBooking(client, target.bookingId);
      const now =
        booking.status === 'EXPIRED' || booking.proofReceptionState === 'RECEIVED'
          ? undefined
          : clock();
      const result = expireDecision(booking, allocations, now);
      if (result.outcome === 'EXPIRED') await expire(client, booking, result.expiredAt);
      return result;
    });
  }
}
module.exports = PgBookingLifecycleRepository;
