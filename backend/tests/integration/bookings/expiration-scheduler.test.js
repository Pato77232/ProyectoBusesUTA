const { randomUUID } = require('node:crypto');
const net = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createBookingsModule } = require('../../../src/modules/bookings');
const { start } = require('../../../src/server');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const {
  summaryInput,
  summaryContext,
} = require('../../unit/bookings/helpers/booking-summary-fixtures');
const pass = (_req, _res, next) => next();
const auth = { authenticate: pass, authorize: () => pass, csrfProtection: pass };
const started = new Date('2026-11-03T14:00:00Z');
const deadline = new Date('2026-11-03T14:05:00Z');
let pool;
async function clear() {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
  );
}
beforeAll(async () => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
});
beforeEach(clear);
afterAll(async () => {
  if (pool) {
    await clear();
    await pool.end();
  }
});
async function create(at = started) {
  const context = {
    ...summaryContext(),
    bookingId: randomUUID(),
    ownerId: 'owner-qa',
    startedAt: new Date(at),
    proofWindowSeconds: 300,
  };
  context.trip = { ...context.trip, tripId: randomUUID(), cooperativeId: randomUUID() };
  return new PgBookingRepository({ pool }).reserve(
    { tripId: context.trip.tripId, cooperativeId: context.trip.cooperativeId },
    async () => ({
      input: { ...summaryInput(), tripId: context.trip.tripId, summaryAccepted: true },
      context,
    }),
  );
}
function bookings(clock = () => new Date(deadline), options = {}) {
  return createBookingsModule({
    pool,
    auth,
    clock,
    env: {
      BOOKING_PROOF_WINDOW_SECONDS: '300',
      BOOKING_EXPIRATION_BATCH_SIZE: '1',
      BOOKING_EXPIRATION_INTERVAL_MS: '100',
    },
    ...options,
  });
}
async function snapshot() {
  return {
    bookings: (await pool.query('SELECT * FROM bookings ORDER BY id')).rows,
    seats: (await pool.query('SELECT * FROM booking_seat_allocations ORDER BY booking_id,seat_id'))
      .rows,
  };
}
async function until(check) {
  for (let i = 0; i < 400; i += 1) {
    if (await check()) return;
    await delay(10);
  }
  throw new Error('No se observó el resultado esperado en PostgreSQL.');
}
function receipt(booking, module) {
  const input = {
    bookingId: booking.bookingId,
    cooperativeId: booking.summary.cooperativeId,
    paymentProofId: randomUUID(),
  };
  // Fuente QA explícita; no acredita autorización de carga HTTP ni conexión productiva de Payments.
  const receiver = module.createPaymentProofReceiver({
    receiptSource: async () => ({
      ...input,
      status: 'UPLOADED',
      notificationStatus: 'PENDING',
      uploadedAt: started.toISOString(),
    }),
  });
  return () => receiver.markPaymentProofReceived(input);
}
function commitBarrier() {
  let release, reached;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const ready = new Promise((resolve) => {
    reached = resolve;
  });
  let held = false;
  return {
    release,
    ready,
    pool: {
      query: pool.query.bind(pool),
      async connect() {
        const client = await pool.connect();
        return {
          release: (error) => client.release(error),
          async query(...args) {
            if (args[0] === 'COMMIT' && !held) {
              held = true;
              const { rows } = await client.query('SELECT pg_backend_pid() pid');
              reached(rows[0].pid);
              await waiting;
            }
            return client.query(...args);
          },
        };
      },
    },
  };
}
async function blocked(pid) {
  await until(
    async () =>
      (
        await pool.query(
          'SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) present',
          [pid],
        )
      ).rows[0].present,
  );
}
test('antes del límite no selecciona; en el límite libera y repetir conserva el resultado', async () => {
  const booking = await create();
  expect(
    await bookings(() => new Date(deadline.getTime() - 1)).maintenance.runExpirationBatch(),
  ).toMatchObject({ scanned: 0 });
  expect(await bookings().maintenance.runExpirationBatch()).toMatchObject({ expired: 1 });
  const stored = await snapshot();
  expect(stored.bookings[0]).toMatchObject({ status: 'EXPIRED', expired_at: deadline });
  expect(stored.seats.every((seat) => !seat.active)).toBe(true);
  await bookings().maintenance.runExpirationBatch();
  expect(await snapshot()).toEqual(stored);
  expect(
    (await pool.query('SELECT expires_at FROM bookings WHERE id=$1', [booking.bookingId])).rows[0]
      .expires_at,
  ).toEqual(deadline);
});
test('conserva recepción aceptada y estado histórico UNKNOWN sin interpretarlos como libres', async () => {
  const accepted = await create();
  await receipt(
    accepted,
    bookings(() => new Date(deadline.getTime() - 1)),
  )();
  const legacy = await create();
  const legacyId = randomUUID();
  // Simular esquema histórico por INSERT con defaults, sin violar la inmutabilidad del plazo.
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,base_price_cents,discount_cents,total_price_cents,created_at,expires_at)
    SELECT $2,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,base_price_cents,discount_cents,total_price_cents,created_at,expires_at FROM bookings WHERE id=$1`,
    [legacy.bookingId, legacyId],
  );
  await pool.query(
    `INSERT INTO booking_seat_allocations SELECT $2,cooperative_id,trip_id,seat_id,from_position,to_position,status,active FROM booking_seat_allocations WHERE booking_id=$1`,
    [legacy.bookingId, legacyId],
  );
  await pool.query('DELETE FROM bookings WHERE id=$1', [legacy.bookingId]);
  const before = await snapshot();
  expect(await bookings().maintenance.runExpirationBatch()).toMatchObject({ scanned: 0 });
  expect(await snapshot()).toEqual(before);
});
test('fila inconsistente SOLD no bloquea otras cooperativas y se recupera en el pase siguiente', async () => {
  const bad = await create();
  await create(new Date(started.getTime() + 1));
  await pool.query("UPDATE booking_seat_allocations SET status='SOLD' WHERE booking_id=$1", [
    bad.bookingId,
  ]);
  const maintenance = bookings(() => new Date(deadline.getTime() + 1)).maintenance;
  expect(await maintenance.runExpirationBatch()).toMatchObject({ failed: 1 });
  expect(
    (
      await pool.query('SELECT active FROM booking_seat_allocations WHERE booking_id=$1', [
        bad.bookingId,
      ])
    ).rows.every((s) => s.active),
  ).toBe(true);
  expect(await maintenance.runExpirationBatch()).toMatchObject({ expired: 1 });
  await maintenance.runExpirationBatch();
  await pool.query("UPDATE booking_seat_allocations SET status='RESERVED' WHERE booking_id=$1", [
    bad.bookingId,
  ]);
  expect(await maintenance.runExpirationBatch()).toMatchObject({ expired: 1 });
});
test('reiniciar trabajador recupera pendientes y no mueve el plazo persistido', async () => {
  await create();
  await create();
  await create();
  await bookings().maintenance.runExpirationBatch();
  const worker = bookings().maintenance.startExpirationWorker();
  try {
    await until(
      async () =>
        (await pool.query("SELECT count(*)::int n FROM bookings WHERE status='EXPIRED'")).rows[0]
          .n === 3,
    );
  } finally {
    await worker.stop();
  }
  expect(
    (await snapshot()).bookings.every((b) => b.expires_at.getTime() === deadline.getTime()),
  ).toBe(true);
});
test('consulta fallida se informa y el trabajador reintenta sin convertirla en lista vacía', async () => {
  await create();
  let failed = false;
  const failingPool = {
    connect: pool.connect.bind(pool),
    async query(...args) {
      if (String(args[0]).includes('ORDER BY expires_at,id') && !failed) {
        failed = true;
        throw new Error('SQL privado QA');
      }
      return pool.query(...args);
    },
  };
  const onFailure = jest.fn();
  const worker = bookings(undefined, { pool: failingPool }).maintenance.startExpirationWorker({
    onFailure,
  });
  try {
    await until(async () => (await snapshot()).bookings[0].status === 'EXPIRED');
  } finally {
    await worker.stop();
  }
  expect(onFailure).toHaveBeenCalledWith({ code: 'BOOKING_LIFECYCLE_UNAVAILABLE', phase: 'batch' });
  expect(onFailure).toHaveBeenCalledTimes(1);
});
test('dos trabajadores se serializan y conservan una sola expiración persistida', async () => {
  await create();
  const barrier = commitBarrier();
  const first = bookings(undefined, { pool: barrier.pool }).maintenance.runExpirationBatch();
  const pid = await barrier.ready;
  const second = bookings().maintenance.runExpirationBatch();
  try {
    await blocked(pid);
  } finally {
    barrier.release();
  }
  expect((await Promise.all([first, second])).map((r) => r.expired)).toEqual([1, 1]);
  const stored = await snapshot();
  expect(stored.bookings[0].expired_at).toEqual(deadline);
  expect(stored.seats.every((s) => !s.active)).toBe(true);
});
test('recepción aceptada todavía invisible al selector prevalece al releer bajo bloqueo', async () => {
  const booking = await create();
  const barrier = commitBarrier();
  const receiving = receipt(
    booking,
    bookings(() => new Date(deadline.getTime() - 1), { pool: barrier.pool }),
  )();
  const pid = await barrier.ready;
  const expiring = bookings().maintenance.runExpirationBatch();
  try {
    await blocked(pid);
  } finally {
    barrier.release();
  }
  expect((await receiving).outcome).toBe('ACCEPTED');
  expect(await expiring).toMatchObject({ protected: 1, expired: 0 });
  const stored = await snapshot();
  expect(stored.bookings[0].proof_reception_state).toBe('RECEIVED');
  expect(stored.seats.every((s) => s.active)).toBe(true);
});
test('expiración ganadora no se reactiva al llegar comprobante tardío', async () => {
  const booking = await create();
  const barrier = commitBarrier();
  const expiring = bookings(undefined, { pool: barrier.pool }).maintenance.runExpirationBatch();
  const pid = await barrier.ready;
  const receiving = receipt(booking, bookings())();
  try {
    await blocked(pid);
  } finally {
    barrier.release();
  }
  expect(await expiring).toMatchObject({ expired: 1 });
  expect((await receiving).outcome).toBe('REJECTED_EXPIRED');
  expect((await snapshot()).seats.every((s) => !s.active)).toBe(true);
});
test('arranque real recupera reserva previa y cierre drena el trabajador', async () => {
  await create(new Date(Date.now() - 301000));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const previousTerm = process.listenerCount('SIGTERM');
  const previousInt = process.listenerCount('SIGINT');
  const running = await start({
    PORT: String(port),
    DATABASE_URL: assertTestDatabase(),
    JWT_SECRET: 'secreto-ficticio-solo-para-pruebas-http-123456',
    JWT_EXPIRES_IN: '30m',
    BOOKING_EXPIRATION_INTERVAL_MS: '100',
  });
  try {
    expect((await fetch(`http://127.0.0.1:${port}/api/v1/health`)).status).toBe(200);
    await until(async () => (await snapshot()).bookings[0].status === 'EXPIRED');
  } finally {
    await running.stop();
  }
  expect(process.listenerCount('SIGTERM')).toBe(previousTerm);
  expect(process.listenerCount('SIGINT')).toBe(previousInt);
});
