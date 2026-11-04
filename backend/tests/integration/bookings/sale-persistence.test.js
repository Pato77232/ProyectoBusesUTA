const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const PgLifecycle = require('../../../src/modules/bookings/infrastructure/pg-booking-lifecycle.repository');
const { paymentBooking } = require('../../../src/modules/bookings/domain/payment-booking');
const {
  summaryInput,
  summaryContext,
} = require('../../unit/bookings/helpers/booking-summary-fixtures');
const started = new Date('2026-11-04T14:00:00.000Z');
const received = new Date('2026-11-04T14:01:00.000Z');
const confirmed = new Date('2026-11-04T15:00:00.000Z');
let pool, bookings, lifecycle;
beforeAll(() => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  bookings = new PgBookingRepository({ pool });
  lifecycle = new PgLifecycle({ pool });
});
async function clear() {
  await pool.query(
    'TRUNCATE booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
  );
}
beforeEach(clear);
afterAll(async () => {
  if (pool) {
    await clear();
    await pool.end();
  }
});
async function fixture(accept = true) {
  const context = {
    ...summaryContext(),
    bookingId: randomUUID(),
    ownerId: 'owner-qa',
    startedAt: started,
    proofWindowSeconds: 300,
  };
  const scope = { tripId: context.trip.tripId, cooperativeId: context.trip.cooperativeId };
  const booking = await bookings.reserve(scope, async () => ({
    input: { ...summaryInput(), summaryAccepted: true },
    context,
  }));
  const target = {
    bookingId: booking.bookingId,
    cooperativeId: scope.cooperativeId,
    paymentProofId: randomUUID(),
  };
  if (accept) await lifecycle.receive(target, () => received);
  return {
    booking,
    target,
    attempt: {
      ...target,
      proofVersion: 1,
      requestedBy: 'clerk-qa',
      requestedAt: '2026-11-04T14:02:00.000Z',
    },
  };
}
async function state() {
  return {
    bookings: (await pool.query('SELECT * FROM bookings ORDER BY id')).rows,
    seats: (await pool.query('SELECT * FROM booking_seat_allocations ORDER BY booking_id,seat_id'))
      .rows,
    receipts: (
      await pool.query('SELECT * FROM booking_proof_receipt_results ORDER BY payment_proof_id')
    ).rows,
  };
}
function wrappedPool(onQuery) {
  return {
    connect: async () => {
      const client = await pool.connect();
      return { release: (e) => client.release(e), query: async (...args) => onQuery(client, args) };
    },
  };
}
async function waitBlocked(pid, count) {
  for (let i = 0; i < 300; i++) {
    const {
      rows: [r],
    } = await pool.query(
      `WITH RECURSIVE waiting(pid) AS (
      SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))
      UNION SELECT a.pid FROM pg_stat_activity a JOIN waiting w ON w.pid=ANY(pg_blocking_pids(a.pid)))
      SELECT count(*)::int n FROM waiting`,
      [pid],
    );
    if (r.n >= count) return;
    await delay(10);
  }
  throw new Error('No se observó bloqueo PostgreSQL real.');
}
async function race(target, first, second) {
  const holder = await pool.connect();
  const pending = [];
  let failure;
  try {
    await holder.query('BEGIN');
    const {
      rows: [{ pid }],
    } = await holder.query('SELECT pg_backend_pid() pid');
    await holder.query(
      'SELECT trip_id FROM booking_trip_locks WHERE cooperative_id=$1 AND trip_id=$2 FOR UPDATE',
      [target.cooperativeId, 'viaje-prueba'],
    );
    pending.push(first());
    await waitBlocked(pid, 1);
    pending.push(second());
    await waitBlocked(pid, 2);
  } catch (e) {
    failure = e;
  } finally {
    await holder.query('COMMIT');
    holder.release();
  }
  const results = await Promise.allSettled(pending);
  if (failure) throw failure;
  for (const r of results) if (r.status === 'rejected') throw r.reason;
  return results.map((r) => r.value);
}

test('persiste versión, total original y todos los asientos SOLD activos después del plazo inicial', async () => {
  const { booking, attempt } = await fixture();
  const result = await lifecycle.confirmSale(attempt, () => confirmed);
  expect(result).toEqual({
    ...attempt,
    currency: 'USD',
    totalPriceCents: booking.summary.totals.totalPriceCents,
    confirmedAt: confirmed.toISOString(),
  });
  const current = await state();
  expect(current.bookings[0]).toMatchObject({
    status: 'CONFIRMED',
    sale_proof_version: '1',
    sale_requested_by: 'clerk-qa',
    confirmed_at: confirmed,
    expired_at: null,
  });
  expect(current.seats).toHaveLength(2);
  for (const seat of current.seats)
    expect(seat).toMatchObject({
      status: 'SOLD',
      active: true,
      from_position: '1',
      to_position: '3',
    });
  const scope = { tripId: booking.summary.tripId, cooperativeId: attempt.cooperativeId };
  const {
    listSeatAvailability,
  } = require('../../../src/modules/bookings/domain/seat-availability');
  const allocations = await bookings.listEffectiveByTrip(scope);
  expect(
    listSeatAvailability({
      query: { ...scope, fromPosition: 2, toPosition: 4 },
      seatIds: ['01', '02'],
      allocations,
    }).every((s) => s.status === 'SOLD'),
  ).toBe(true);
  expect(
    listSeatAvailability({
      query: { ...scope, fromPosition: 3, toPosition: 4 },
      seatIds: ['01', '02'],
      allocations,
    }).every((s) => s.status === 'AVAILABLE'),
  ).toBe(true);
});

test('reintento recupera resultado original sin reloj y no reescribe filas', async () => {
  const { attempt } = await fixture();
  const result = await lifecycle.confirmSale(attempt, () => confirmed);
  const before = await state();
  expect(
    await lifecycle.confirmSale(attempt, () => {
      throw new Error('No debe evaluar reloj');
    }),
  ).toEqual(result);
  expect(await state()).toEqual(before);
});

test('dos aprobaciones concurrentes producen una sola venta', async () => {
  const { attempt, target } = await fixture();
  const results = await race(
    target,
    () => lifecycle.confirmSale(attempt, () => confirmed),
    () => lifecycle.confirmSale(attempt, () => confirmed),
  );
  expect(results[0]).toEqual(results[1]);
  expect((await state()).seats.every((s) => s.status === 'SOLD' && s.active)).toBe(true);
});

test.each([true, false])(
  'expiración concurrente no libera la venta: venta primero %s',
  async (saleFirst) => {
    const { attempt, target } = await fixture();
    const sell = () => lifecycle.confirmSale(attempt, () => confirmed);
    const expire = () => lifecycle.expire({ bookingId: attempt.bookingId }, () => confirmed);
    await race(target, ...(saleFirst ? [sell, expire] : [expire, sell]));
    expect((await state()).bookings[0].status).toBe('CONFIRMED');
    expect((await state()).seats.every((s) => s.status === 'SOLD' && s.active)).toBe(true);
  },
);

test('lectura autorizada y recepción repetida reconocen venta confirmada', async () => {
  const { attempt, target } = await fixture();
  const original = await lifecycle.findReceipt(target);
  await lifecycle.confirmSale(attempt, () => confirmed);
  expect(
    await lifecycle.receive(target, () => {
      throw new Error('sin reloj');
    }),
  ).toEqual(original);
  expect(await lifecycle.expire({ bookingId: attempt.bookingId }, () => confirmed)).toMatchObject({
    outcome: 'PROOF_RECEIVED',
  });
  expect(
    await lifecycle.listExpiredCandidates({
      cutoff: confirmed.toISOString(),
      after: null,
      limit: 20,
    }),
  ).toEqual([]);
  const request = {
    bookingId: attempt.bookingId,
    purpose: 'REVIEW_PAYMENT',
    cooperativeId: attempt.cooperativeId,
  };
  const row = await bookings.findPaymentRecord(request);
  expect(paymentBooking(row, request, confirmed)).toMatchObject({
    status: 'CONFIRMED',
    canUploadProof: false,
  });
});

test.each(['proofVersion', 'paymentProofId', 'cooperativeId', 'requestedBy'])(
  'no confirma reintento distinto en %s',
  async (key) => {
    const { attempt } = await fixture();
    await lifecycle.confirmSale(attempt, () => confirmed);
    const before = await state();
    await expect(
      lifecycle.confirmSale(
        { ...attempt, [key]: key === 'proofVersion' ? 2 : 'otro' },
        () => confirmed,
      ),
    ).rejects.toBeDefined();
    expect(await state()).toEqual(before);
  },
);

test.each(['NOT_RECEIVED', 'EXPIRED', 'UNKNOWN'])(
  'rechaza reserva no confirmable %s sin cambios',
  async (kind) => {
    const { attempt } = await fixture(false);
    if (kind === 'EXPIRED')
      await lifecycle.expire({ bookingId: attempt.bookingId }, () => confirmed);
    if (kind === 'UNKNOWN') {
      // Un histórico nace UNKNOWN; convertir un contexto conocido está protegido por trigger.
      const old = await state();
      const row = old.bookings[0];
      await pool.query('DELETE FROM bookings WHERE id=$1', [attempt.bookingId]);
      await pool.query(
        `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
        base_price_cents,discount_cents,total_price_cents,created_at,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,'PENDING_PAYMENT',$7,$8,$9,$10,$11,$12)`,
        [
          row.id,
          row.cooperative_id,
          row.trip_id,
          row.owner_id,
          row.from_position,
          row.to_position,
          row.summary,
          row.base_price_cents,
          row.discount_cents,
          row.total_price_cents,
          row.created_at,
          row.expires_at,
        ],
      );
      for (const seat of old.seats)
        await pool.query(
          `INSERT INTO booking_seat_allocations
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            seat.booking_id,
            seat.cooperative_id,
            seat.trip_id,
            seat.seat_id,
            seat.from_position,
            seat.to_position,
            seat.status,
            seat.active,
          ],
        );
    }
    const before = await state();
    await expect(lifecycle.confirmSale(attempt, () => confirmed)).rejects.toMatchObject({
      code: 'BOOKING_SALE_NOT_CONFIRMABLE',
    });
    expect(await state()).toEqual(before);
  },
);

test('conjunto de asientos adulterado con igual cantidad no se vende', async () => {
  const { attempt } = await fixture();
  await pool.query("UPDATE booking_seat_allocations SET seat_id='ajeno' WHERE seat_id='01'");
  const before = await state();
  await expect(lifecycle.confirmSale(attempt, () => confirmed)).rejects.toMatchObject({
    code: 'BOOKING_SALE_DATA_INTEGRITY_ERROR',
  });
  expect(await state()).toEqual(before);
});

test('fallo real tras actualizar el primer asiento revierte todos los cambios', async () => {
  const { attempt } = await fixture();
  const before = await state();
  let changed = 0;
  const failing = new PgLifecycle({
    pool: wrappedPool(async (client, args) => {
      if (typeof args[0] === 'string' && args[0].startsWith('UPDATE booking_seat_allocations')) {
        changed++;
        if (changed === 2) throw new Error('Fallo QA segundo asiento');
      }
      return client.query(...args);
    }),
  });
  await expect(failing.confirmSale(attempt, () => confirmed)).rejects.toBeDefined();
  expect(changed).toBe(2);
  expect(await state()).toEqual(before);
});

test('respuesta perdida después del COMMIT real se recupera sin duplicar', async () => {
  const { attempt } = await fixture();
  let lost = false;
  const uncertain = new PgLifecycle({
    pool: wrappedPool(async (client, args) => {
      const result = await client.query(...args);
      if (args[0] === 'COMMIT' && !lost) {
        lost = true;
        throw new Error('Respuesta COMMIT perdida');
      }
      return result;
    }),
  });
  await expect(uncertain.confirmSale(attempt, () => confirmed)).rejects.toBeDefined();
  const before = await state();
  expect(before.bookings[0].status).toBe('CONFIRMED');
  expect(await lifecycle.confirmSale(attempt, () => confirmed)).toMatchObject({
    confirmedAt: confirmed.toISOString(),
  });
  expect(await state()).toEqual(before);
});

test('CHECK impide confirmación incompleta; una venta confirmada no se modifica ni se revierte por down', async () => {
  const { attempt } = await fixture();
  await expect(
    pool.query("UPDATE bookings SET status='CONFIRMED' WHERE id=$1", [attempt.bookingId]),
  ).rejects.toMatchObject({ code: '23514' });
  await lifecycle.confirmSale(attempt, () => confirmed);
  const before = await state();
  await expect(
    pool.query("UPDATE bookings SET status='EXPIRED' WHERE id=$1", [attempt.bookingId]),
  ).rejects.toMatchObject({ code: '23514' });
  expect(() => runMigration('down')).toThrow();
  expect(await state()).toEqual(before);
});

test('migración vacía revierte y reaplica sin perder historial previo', async () => {
  const before = (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map(
    (r) => r.name,
  );
  runMigration('down');
  expect(
    (
      await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='bookings' AND column_name='sale_proof_version'",
      )
    ).rows,
  ).toEqual([]);
  expect(
    (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map((r) => r.name),
  ).toEqual(before.slice(0, -1));
  runMigration();
  expect(
    (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map((r) => r.name),
  ).toEqual(before);
});

test('fallo después de escribir la reserva confirmada revierte también todos los asientos', async () => {
  const { attempt } = await fixture();
  const before = await state();
  let written = false;
  const failing = new PgLifecycle({
    pool: wrappedPool(async (client, args) => {
      const result = await client.query(...args);
      if (
        typeof args[0] === 'string' &&
        args[0].startsWith("UPDATE bookings SET status='CONFIRMED'")
      ) {
        written = true;
        throw new Error('Fallo QA después del registro de venta');
      }
      return result;
    }),
  });
  await expect(failing.confirmSale(attempt, () => confirmed)).rejects.toBeDefined();
  expect(written).toBe(true);
  expect(await state()).toEqual(before);
});
