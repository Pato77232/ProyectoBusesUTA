const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const getBookingSummary = require('../../../src/modules/bookings/application/get-booking-summary.use-case');
const createBooking = require('../../../src/modules/bookings/application/create-booking.use-case');
const purchaseSetup = require('../../unit/bookings/helpers/booking-purchase-fixtures');
const { summaryContext } = require('../../unit/bookings/helpers/booking-summary-fixtures');

let pool;
let repository;
const key = '00000000-0000-4000-8000-000000000001';
const otherKey = '00000000-0000-4000-8000-000000000002';

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgBookingRepository({ pool });
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE booking_proof_receipt_results, booking_seat_allocations, bookings, booking_trip_locks',
  );
});
afterAll(async () => {
  if (pool) await pool.end();
});

async function setup() {
  // Dobles solo para servicios externos; PostgreSQL y sus transacciones son reales.
  const fixture = purchaseSetup();
  const { dependencies, input, authContext } = fixture;
  const preview = await getBookingSummary(dependencies)(input, authContext);
  Object.assign(dependencies, { repository, proofWindowSeconds: 180, newId: jest.fn(randomUUID) });
  dependencies.passengerVerifier.verify.mockClear();
  return {
    ...fixture,
    execute: createBooking(dependencies),
    request: {
      ...input,
      summaryAccepted: true,
      acceptedSummaryRevision: preview.summaryRevision,
      requestKey: key,
    },
  };
}

async function counts() {
  const { rows } = await pool.query(`SELECT (SELECT count(*)::int FROM bookings) AS bookings,
    (SELECT count(*)::int FROM booking_seat_allocations) AS allocations`);
  return rows[0];
}

function failingRepository(intercept) {
  return new PgBookingRepository({
    pool: {
      connect: async () => {
        const client = await pool.connect();
        return {
          release: (error) => client.release(error),
          query: (sql, params) => intercept(client, sql, params),
        };
      },
    },
  });
}

test('recupera después de COMMIT exitoso cuya respuesta se perdió, incluso en instancia nueva', async () => {
  const { dependencies, request, authContext } = await setup();
  const lostReply = new Error('respuesta perdida después del COMMIT real');
  let fail = true;
  const failed = failingRepository(async (client, sql, params) => {
    const result = await client.query(sql, params);
    if (sql === 'COMMIT' && fail) {
      fail = false;
      throw lostReply;
    }
    return result;
  });
  await expect(
    createBooking({ ...dependencies, repository: failed })(request, authContext),
  ).rejects.toBe(lostReply);
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
  const { rows } = await pool.query('SELECT * FROM bookings');
  const original = rows[0];
  dependencies.tripCatalog.findBookableById.mockRejectedValue(new Error('catálogo caído'));
  dependencies.passengerVerifier.verify.mockRejectedValue(new Error('verificador caído'));
  dependencies.tripCatalog.findBookableById.mockClear();
  dependencies.passengerVerifier.verify.mockClear();
  dependencies.clock.mockImplementation(() => {
    throw new Error('no iniciar otro plazo');
  });
  dependencies.newId.mockClear();
  const restarted = createBooking({
    ...dependencies,
    repository: new PgBookingRepository({ pool }),
  });
  const recovered = await restarted(request, authContext);
  expect(recovered.bookingId).toBe(original.id);
  expect(recovered.expiresAt).toBe(original.expires_at.toISOString());
  expect(recovered.summary.totals.totalPriceCents).toBe(752);
  expect(recovered).not.toHaveProperty('creation_request_key');
  expect(Object.isFrozen(recovered.summary.passengers[0])).toBe(true);
  expect(dependencies.tripCatalog.findBookableById).not.toHaveBeenCalled();
  expect(dependencies.passengerVerifier.verify).not.toHaveBeenCalled();
  expect(dependencies.newId).not.toHaveBeenCalled();
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('reintentar tras el plazo y cambiar configuración/precio no renueva ni recalcula la reserva', async () => {
  const { execute, dependencies, request } = await setup();
  const original = await execute(request);
  const trip = await dependencies.tripCatalog.findBookableById();
  trip.segmentPricesCents[1] = 9999;
  dependencies.clock.mockReturnValue(new Date('2026-11-01T10:00:00Z'));
  const repeated = await createBooking({ ...dependencies, proofWindowSeconds: 300 })(request);
  expect(repeated).toEqual(original);
  expect(repeated.expiresAt).toBe('2026-10-27T15:03:00.000Z');
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test.each(['passenger', 'trip', 'revision', 'route'])(
  'misma clave con cambio de %s da conflicto antes de consultar catálogo',
  async (change) => {
    const { execute, dependencies, request } = await setup();
    await execute(request);
    const changed = JSON.parse(JSON.stringify(request));
    if (change === 'passenger') changed.passengers[0].fullName = 'Otra Persona';
    if (change === 'trip') changed.tripId = 'otro-viaje';
    if (change === 'revision') changed.acceptedSummaryRevision = '0'.repeat(64);
    if (change === 'route') changed.toPosition = 4;
    dependencies.tripCatalog.findBookableById.mockClear();
    await expect(execute(changed)).rejects.toMatchObject({ code: 'BOOKING_REQUEST_KEY_REUSED' });
    expect(dependencies.tripCatalog.findBookableById).not.toHaveBeenCalled();
    expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
  },
);

test('no depende del orden JSON ni del orden de pasajeros en el reenvío', async () => {
  const { execute, request } = await setup();
  const first = await execute(request);
  const repeated = Object.fromEntries(Object.entries(request).reverse());
  repeated.passengers = [...request.passengers]
    .reverse()
    .map((passenger) => Object.fromEntries(Object.entries(passenger).reverse()));
  expect(await execute(repeated)).toEqual(first);
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('otro dueño no recupera la reserva aunque conozca la clave y la solicitud', async () => {
  const { execute, dependencies, request } = await setup();
  await execute(request);
  dependencies.buyerIdentity.resolve.mockResolvedValue({ ownerId: 'otro-cliente' });
  await expect(execute(request)).rejects.toMatchObject({ code: 'BOOKING_SEAT_CONFLICT' });
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
  expect((await pool.query('SELECT owner_id FROM bookings')).rows).toEqual([
    { owner_id: 'cliente-prueba' },
  ]);
});

test('una clave igual de otro comprador puede crear otra compra válida sin colisionar por clave', async () => {
  const { execute, dependencies, input, request } = await setup();
  const first = await execute(request);
  dependencies.buyerIdentity.resolve.mockResolvedValue({ ownerId: 'otro-cliente' });
  const trip = await dependencies.tripCatalog.findBookableById();
  dependencies.tripCatalog.findBookableById.mockResolvedValue({
    ...trip,
    tripId: 'otro-viaje',
    cooperativeId: 'otra-cooperativa',
  });
  const nextInput = { ...input, tripId: 'otro-viaje' };
  const preview = await getBookingSummary(dependencies)(nextInput);
  const second = await execute({
    ...nextInput,
    summaryAccepted: true,
    requestKey: key,
    acceptedSummaryRevision: preview.summaryRevision,
  });
  expect(second.bookingId).not.toBe(first.bookingId);
  expect(second.ownerId).toBe('otro-cliente');
  expect(await counts()).toEqual({ bookings: 2, allocations: 4 });
});

async function race(fixture, secondRequest, waitQuery) {
  const { execute, request, dependencies } = fixture;
  let enter;
  let release;
  const entered = new Promise((resolve) => {
    enter = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const entries = summaryContext().passengerBenefits.map((entry) => ({
    ...entry,
    birthDateVerified: true,
  }));
  dependencies.passengerVerifier.verify.mockImplementationOnce(async () => {
    enter();
    await gate;
    return entries;
  });
  const first = execute(request);
  await entered;
  const settled = Promise.allSettled([first, execute(secondRequest)]);
  try {
    let blocked = false;
    const limit = Date.now() + 3000;
    while (!blocked && Date.now() < limit) {
      const { rows } = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query LIKE $1 AND pid <> pg_backend_pid()) AS blocked`,
        [waitQuery],
      );
      blocked = rows[0].blocked;
      if (!blocked) await delay(10);
    }
    expect(blocked).toBe(true);
  } finally {
    release();
  }
  return settled;
}

test('misma clave concurrente se serializa y devuelve una única reserva a ambas llamadas', async () => {
  const fixture = await setup();
  const results = await race(fixture, fixture.request, '%pg_advisory_xact_lock%');
  expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
  expect(results[0].value).toEqual(results[1].value);
  expect(fixture.dependencies.passengerVerifier.verify).toHaveBeenCalledTimes(1);
  expect(fixture.dependencies.newId).toHaveBeenCalledTimes(1);
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('misma clave concurrente con datos distintos rechaza la segunda sin prepararla', async () => {
  const fixture = await setup();
  const results = await race(
    fixture,
    { ...fixture.request, acceptedSummaryRevision: '0'.repeat(64) },
    '%pg_advisory_xact_lock%',
  );
  expect(results[0].status).toBe('fulfilled');
  expect(results[1].reason).toMatchObject({ code: 'BOOKING_REQUEST_KEY_REUSED' });
  expect(fixture.dependencies.passengerVerifier.verify).toHaveBeenCalledTimes(1);
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('claves distintas mantienen exclusión de asientos por bloqueo de viaje', async () => {
  const fixture = await setup();
  const results = await race(
    fixture,
    { ...fixture.request, requestKey: otherKey },
    '%INSERT INTO booking_trip_locks%',
  );
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((result) => result.status === 'rejected').reason).toMatchObject({
    code: 'BOOKING_SEAT_CONFLICT',
  });
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test.each(['second-seat', 'before-commit'])(
  'fallo en %s revierte metadatos y permite reintentar la misma clave',
  async (stage) => {
    const { dependencies, request, execute } = await setup();
    const failure = new Error('fallo de prueba antes de confirmar');
    const failing = failingRepository((client, sql, params) => {
      if (
        (stage === 'second-seat' &&
          sql.includes('INSERT INTO booking_seat_allocations') &&
          params[3] === '02') ||
        (stage === 'before-commit' && sql === 'COMMIT')
      )
        throw failure;
      return client.query(sql, params);
    });
    await expect(createBooking({ ...dependencies, repository: failing })(request)).rejects.toBe(
      failure,
    );
    expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
    const created = await execute(request);
    expect((await execute(request)).bookingId).toBe(created.bookingId);
    expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
  },
);

test('propietario preparado distinto del de la operación revierte sin vincular una clave ajena', async () => {
  const { input } = await setup();
  await expect(
    repository.reserveOnce(
      {
        ownerId: 'cliente-prueba',
        requestKey: key,
        requestFingerprint: 'a'.repeat(64),
      },
      async () => ({ tripId: 'viaje-prueba', cooperativeId: 'cooperativa-prueba' }),
      async () => ({
        input: { ...input, summaryAccepted: true },
        context: {
          ...summaryContext(),
          bookingId: randomUUID(),
          ownerId: 'ajeno',
          startedAt: new Date('2026-10-27T15:00:00Z'),
          proofWindowSeconds: 180,
        },
      }),
    ),
  ).rejects.toMatchObject({ code: 'BOOKING_VALIDATION_ERROR' });
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});

test('migración de metadatos es reversible sin eliminar reservas y admite reaplicación', async () => {
  const { execute, request } = await setup();
  const saved = await execute(request);
  const historicalMigration = require('../../../migrations/1793232000000-booking-creation-idempotency');
  const historyBefore = (await pool.query('SELECT * FROM pgmigrations ORDER BY id')).rows;
  const applyHistorical = async (direction) => {
    const statements = [];
    historicalMigration[direction]({ sql: (sql) => statements.push(sql) });
    await pool.query(statements.join(';\n'));
  };
  try {
    await applyHistorical('down');
    expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name LIKE 'creation_request_%'`);
    expect(rows).toEqual([]);
    expect(
      await repository.findByOwner({
        bookingId: saved.bookingId,
        ownerId: saved.ownerId,
        cooperativeId: saved.summary.cooperativeId,
      }),
    ).toEqual(saved);
  } finally {
    await applyHistorical('up');
  }
  expect((await pool.query('SELECT * FROM pgmigrations ORDER BY id')).rows).toEqual(historyBefore);
  const { rows } = await pool.query(
    `SELECT creation_request_key, creation_request_fingerprint
    FROM bookings WHERE id = $1`,
    [saved.bookingId],
  );
  expect(rows[0]).toEqual({ creation_request_key: null, creation_request_fingerprint: null });
});

test.each([
  [key, null],
  [null, 'a'.repeat(64)],
  [key, 'A'.repeat(64)],
  [key.replace('4000', '1000'), 'a'.repeat(64)],
])('base rechaza pareja de metadatos inválida %j / %j', async (requestKey, fingerprint) => {
  const { execute, request } = await setup();
  const booking = await execute(request);
  await expect(
    pool.query(
      `UPDATE bookings SET creation_request_key=$1,
    creation_request_fingerprint=$2 WHERE id=$3`,
      [requestKey, fingerprint, booking.bookingId],
    ),
  ).rejects.toMatchObject({ code: '23514' });
});

test('base impide duplicar una clave del mismo dueño aunque cambie el viaje', async () => {
  const { execute, dependencies, input, request } = await setup();
  const first = await execute(request);
  const trip = await dependencies.tripCatalog.findBookableById();
  dependencies.tripCatalog.findBookableById.mockResolvedValue({ ...trip, tripId: 'otro-viaje' });
  const nextInput = { ...input, tripId: 'otro-viaje' };
  const preview = await getBookingSummary(dependencies)(nextInput);
  const second = await execute({
    ...nextInput,
    summaryAccepted: true,
    requestKey: otherKey,
    acceptedSummaryRevision: preview.summaryRevision,
  });
  await expect(
    pool.query('UPDATE bookings SET creation_request_key=$1 WHERE id=$2', [key, second.bookingId]),
  ).rejects.toMatchObject({ code: '23505' });
  expect(
    (await pool.query('SELECT id FROM bookings WHERE creation_request_key=$1', [key])).rows,
  ).toEqual([{ id: first.bookingId }]);
});
