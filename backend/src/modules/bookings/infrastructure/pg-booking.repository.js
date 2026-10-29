const { createPendingBooking } = require('../domain/pending-booking');
const { listSeatAvailability } = require('../domain/seat-availability');
const { BookingValidationError } = require('../domain/booking-error');
const BookingConflictError = require('../domain/booking-conflict-error');
const {
  createBookingOperation,
  validateRequestKey,
} = require('../domain/booking-creation-request');

function identifier(value) {
  if (typeof value !== 'string' || !value.trim()) throw new BookingValidationError();
  return value.trim();
}

function tripScope(scope) {
  return { tripId: identifier(scope?.tripId), cooperativeId: identifier(scope?.cooperativeId) };
}

function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

function privateBooking(row) {
  return freezeTree({
    bookingId: row.id,
    ownerId: row.owner_id,
    status: row.status,
    summary: row.summary,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
  });
}

async function readAllocations(client, scope) {
  const { rows } = await client.query(
    `SELECT trip_id, cooperative_id, seat_id, from_position, to_position, status
     FROM booking_seat_allocations WHERE cooperative_id = $1 AND trip_id = $2 AND active
     ORDER BY booking_id, seat_id`,
    [scope.cooperativeId, scope.tripId],
  );
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        tripId: row.trip_id,
        cooperativeId: row.cooperative_id,
        seatId: row.seat_id,
        fromPosition: Number(row.from_position),
        toPosition: Number(row.to_position),
        status: row.status,
      }),
    ),
  );
}

async function insertBooking(client, booking, operation) {
  const { summary } = booking;
  await client.query(
    `INSERT INTO bookings (id, cooperative_id, trip_id, owner_id, from_position, to_position,
       status, summary, base_price_cents, discount_cents, total_price_cents, created_at, expires_at,
       creation_request_key, creation_request_fingerprint)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      booking.bookingId,
      summary.cooperativeId,
      summary.tripId,
      booking.ownerId,
      summary.fromPosition,
      summary.toPosition,
      booking.status,
      JSON.stringify(summary),
      summary.totals.basePriceCents,
      summary.totals.discountCents,
      summary.totals.totalPriceCents,
      booking.createdAt,
      booking.expiresAt,
      operation?.requestKey ?? null,
      operation?.requestFingerprint ?? null,
    ],
  );
  for (const passenger of summary.passengers) {
    await client.query(
      `INSERT INTO booking_seat_allocations
       (booking_id, cooperative_id, trip_id, seat_id, from_position, to_position, status)
       VALUES ($1,$2,$3,$4,$5,$6,'RESERVED')`,
      [
        booking.bookingId,
        summary.cooperativeId,
        summary.tripId,
        passenger.seatId,
        summary.fromPosition,
        summary.toPosition,
      ],
    );
  }
}

async function reserveTrip(client, target, prepare, operation) {
  await client.query(
    `INSERT INTO booking_trip_locks (cooperative_id, trip_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [target.cooperativeId, target.tripId],
  );
  await client.query(
    'SELECT trip_id FROM booking_trip_locks WHERE cooperative_id = $1 AND trip_id = $2 FOR UPDATE',
    [target.cooperativeId, target.tripId],
  );
  // prepare pertenece al caso de uso y se ejecuta después del bloqueo de inventario.
  const prepared = await prepare(target);
  const booking = createPendingBooking(prepared?.input, prepared?.context);
  const { summary } = booking;
  if (
    summary.tripId !== target.tripId ||
    summary.cooperativeId !== target.cooperativeId ||
    (operation && booking.ownerId !== operation.ownerId)
  )
    throw new BookingValidationError();
  const seats = listSeatAvailability({
    query: summary,
    seatIds: summary.passengers.map((passenger) => passenger.seatId),
    allocations: await readAllocations(client, target),
  });
  if (seats.some((seat) => seat.status !== 'AVAILABLE')) throw new BookingConflictError();
  await insertBooking(client, booking, operation);
  return booking;
}

class PgBookingRepository {
  constructor({ pool }) {
    this.pool = pool;
  }

  async transaction(execute) {
    const client = await this.pool.connect();
    let connectionFailure;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const result = await execute(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        connectionFailure = rollbackError;
      }
      if (error.code === '23505') throw new BookingConflictError('BOOKING_ALREADY_EXISTS');
      throw error;
    } finally {
      client.release(connectionFailure);
    }
  }

  async reserve(scope, prepare) {
    const target = tripScope(scope);
    if (typeof prepare !== 'function') throw new BookingValidationError();
    return this.transaction((client) => reserveTrip(client, target, prepare));
  }

  async reserveOnce(input, locate, prepare) {
    const operation = createBookingOperation(input);
    if (typeof locate !== 'function' || typeof prepare !== 'function')
      throw new BookingValidationError();
    return this.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        JSON.stringify([operation.ownerId, operation.requestKey]),
      ]);
      const { rows } = await client.query(
        'SELECT * FROM bookings WHERE owner_id = $1 AND creation_request_key = $2',
        [operation.ownerId, operation.requestKey],
      );
      if (rows.length) {
        if (rows[0].creation_request_fingerprint !== operation.requestFingerprint) {
          throw new BookingConflictError('BOOKING_REQUEST_KEY_REUSED');
        }
        return privateBooking(rows[0]);
      }
      const scope = tripScope(await locate());
      return reserveTrip(client, scope, prepare, operation);
    });
  }

  async listEffectiveByTrip(scope) {
    return readAllocations(this.pool, tripScope(scope));
  }

  async findByCreationRequest(input) {
    const ownerId = identifier(input?.ownerId);
    const requestKey = validateRequestKey(input?.requestKey);
    const { rows } = await this.pool.query(
      'SELECT * FROM bookings WHERE owner_id = $1 AND creation_request_key = $2',
      [ownerId, requestKey],
    );
    return rows.length ? privateBooking(rows[0]) : null;
  }
  async findByOwner(scope) {
    const target = {
      bookingId: identifier(scope?.bookingId),
      cooperativeId: identifier(scope?.cooperativeId),
      ownerId: identifier(scope?.ownerId),
    };
    const { rows } = await this.pool.query(
      'SELECT * FROM bookings WHERE id = $1 AND cooperative_id = $2 AND owner_id = $3',
      [target.bookingId, target.cooperativeId, target.ownerId],
    );
    return rows.length ? privateBooking(rows[0]) : null;
  }
}
module.exports = PgBookingRepository;
