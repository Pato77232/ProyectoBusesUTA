const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const getBookingSummary = require('../../../src/modules/bookings/application/get-booking-summary.use-case');
const createBooking = require('../../../src/modules/bookings/application/create-booking.use-case');
const purchaseSetup = require('../../unit/bookings/helpers/booking-purchase-fixtures');

let pool;
let repository;

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgBookingRepository({ pool });
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE booking_seat_allocations, bookings, booking_trip_locks');
});
afterAll(async () => {
  if (pool) await pool.end();
});

async function setup() {
  // Solo identidad/catálogo/acreditación son dobles; transacción y SQL son reales.
  const fixture = purchaseSetup();
  const { dependencies, input, authContext } = fixture;
  const preview = await getBookingSummary(dependencies)(input, authContext);
  Object.assign(dependencies, { repository, proofWindowSeconds: 180, newId: randomUUID });
  return {
    ...fixture,
    execute: createBooking(dependencies),
    request: { ...input, summaryAccepted: true, acceptedSummaryRevision: preview.summaryRevision },
  };
}

async function counts() {
  const { rows } = await pool.query(`SELECT (SELECT count(*)::int FROM bookings) AS bookings,
    (SELECT count(*)::int FROM booking_seat_allocations) AS allocations`);
  return rows[0];
}

test('resumen aceptado se persiste y se recupera solo por su dueño y cooperativa', async () => {
  const { execute, request, authContext } = await setup();
  const booking = await execute(request, authContext);
  const scope = {
    bookingId: booking.bookingId,
    cooperativeId: booking.summary.cooperativeId,
    ownerId: booking.ownerId,
  };
  expect(await repository.findByOwner(scope)).toEqual(booking);
  expect(booking.expiresAt).toBe('2026-10-27T15:03:00.000Z');
  expect(await repository.findByOwner({ ...scope, ownerId: 'otro' })).toBeNull();
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('cambio de tarifa rechaza aceptación y revierte sin reserva, asientos ni bloqueo persistido', async () => {
  const { execute, request, dependencies } = await setup();
  const trip = await dependencies.tripCatalog.findBookableById();
  trip.segmentPricesCents[1] += 100;
  await expect(execute(request)).rejects.toMatchObject({ code: 'BOOKING_SUMMARY_CHANGED' });
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
  expect((await pool.query('SELECT * FROM booking_trip_locks')).rows).toEqual([]);
  // Tras aceptar el precio nuevo se puede usar la misma conexión/inventario.
  const { summaryAccepted, acceptedSummaryRevision, ...summaryInput } = request;
  const updated = await getBookingSummary(dependencies)(summaryInput);
  await execute({ ...request, acceptedSummaryRevision: updated.summaryRevision });
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('falta de acreditación de tarifa preferencial revierte la transacción', async () => {
  const { execute, request, dependencies } = await setup();
  const entries = await dependencies.passengerVerifier.verify();
  entries.find((entry) => entry.seatId === '02').birthDateVerified = false;
  await expect(execute(request)).rejects.toMatchObject({ code: 'BOOKING_BENEFIT_REVIEW_REQUIRED' });
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});

test('fallo del verificador bajo bloqueo no deja transacción abierta ni asientos ocupados', async () => {
  const { execute, request, dependencies } = await setup();
  const failure = new Error('verificador de prueba no disponible');
  dependencies.passengerVerifier.verify.mockRejectedValueOnce(failure);
  await expect(execute(request)).rejects.toBe(failure);
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
  await execute(request);
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('reenvío secuencial no duplica una reserva incompatible ni devuelve un éxito ficticio', async () => {
  const { execute, request } = await setup();
  await execute(request);
  await expect(execute(request)).rejects.toMatchObject({ code: 'BOOKING_SEAT_CONFLICT' });
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('dos casos de uso concurrentes esperan el mismo bloqueo y solo uno crea la reserva', async () => {
  const { execute, request, dependencies } = await setup();
  let enter;
  let release;
  const entered = new Promise((resolve) => {
    enter = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const entries = await dependencies.passengerVerifier.verify();
  dependencies.passengerVerifier.verify.mockImplementationOnce(async () => {
    enter();
    await gate;
    return entries;
  });
  const first = execute(request);
  await entered;
  const settled = Promise.allSettled([first, execute(request)]);
  try {
    let blocked = false;
    const limit = Date.now() + 3000;
    while (!blocked && Date.now() < limit) {
      const { rows } = await pool.query(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query LIKE '%INSERT INTO booking_trip_locks%' AND pid <> pg_backend_pid()) AS blocked`);
      blocked = rows[0].blocked;
      if (!blocked) await delay(10);
    }
    expect(blocked).toBe(true);
  } finally {
    release();
  }
  const results = await settled;
  expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((entry) => entry.status === 'rejected').reason).toMatchObject({
    code: 'BOOKING_SEAT_CONFLICT',
  });
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('cambio de cooperativa al releer el viaje revierte sin mezclar inventarios', async () => {
  const { execute, request, dependencies } = await setup();
  const trip = await dependencies.tripCatalog.findBookableById();
  dependencies.tripCatalog.findBookableById
    .mockResolvedValueOnce(trip)
    .mockResolvedValueOnce({ ...trip, cooperativeId: 'otra-cooperativa' });
  await expect(execute(request)).rejects.toMatchObject({ code: 'BOOKING_SUMMARY_CHANGED' });
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});
