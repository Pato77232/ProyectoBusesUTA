const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const {
  summaryInput,
  summaryContext,
} = require('../../unit/bookings/helpers/booking-summary-fixtures');

let pool;
let repository;
const scope = Object.freeze({ tripId: 'viaje-prueba', cooperativeId: 'cooperativa-prueba' });

function prepared(overrides = {}) {
  const input = { ...summaryInput(), summaryAccepted: true };
  const context = {
    ...summaryContext(),
    bookingId: overrides.bookingId || randomUUID(),
    ownerId: overrides.ownerId || 'cliente-prueba',
    startedAt: new Date('2026-10-27T15:00:00.000Z'),
    proofWindowSeconds: 300,
  };
  for (const field of ['fromPosition', 'toPosition', 'seatIds']) {
    if (overrides[field] !== undefined) input[field] = overrides[field];
  }
  input.passengers = input.passengers.filter((passenger) =>
    input.seatIds.includes(passenger.seatId),
  );
  context.passengerBenefits = context.passengerBenefits.filter((entry) =>
    input.seatIds.includes(entry.seatId),
  );
  for (const field of ['tripId', 'cooperativeId']) {
    if (overrides[field] !== undefined) context.trip[field] = overrides[field];
  }
  input.tripId = context.trip.tripId;
  return { input, context };
}

async function counts() {
  const { rows } = await pool.query(`SELECT (SELECT count(*)::int FROM bookings) AS bookings,
    (SELECT count(*)::int FROM booking_seat_allocations) AS allocations`);
  return rows[0];
}

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgBookingRepository({ pool });
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE booking_guest_access_tokens, booking_proof_receipt_results, booking_seat_allocations, bookings, booking_trip_locks',
  );
});
afterAll(async () => {
  if (pool) await pool.end();
});

test('persiste resumen, pasajeros, importes y plazo con todas las ocupaciones', async () => {
  const data = prepared();
  const booking = await repository.reserve(scope, async () => data);
  const read = await repository.findByOwner({
    ...scope,
    bookingId: booking.bookingId,
    ownerId: booking.ownerId,
  });
  expect(read).toEqual(booking);
  expect(read.summary.totals.totalPriceCents).toBe(752);
  expect(read.summary.passengers.map((passenger) => passenger.seatId)).toEqual(['01', '02']);
  expect(Object.isFrozen(read.summary.passengers[0].quote)).toBe(true);
  const allocations = await repository.listEffectiveByTrip(scope);
  expect(allocations).toEqual([
    { ...scope, seatId: '01', fromPosition: 1, toPosition: 3, status: 'RESERVED' },
    { ...scope, seatId: '02', fromPosition: 1, toPosition: 3, status: 'RESERVED' },
  ]);
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test.each([{ ownerId: 'otro' }, { cooperativeId: 'otra' }, { bookingId: 'otra' }])(
  'no revela una reserva de otro contexto: %j',
  async (change) => {
    const booking = await repository.reserve(scope, async () => prepared());
    expect(
      await repository.findByOwner({
        ...scope,
        bookingId: booking.bookingId,
        ownerId: booking.ownerId,
        ...change,
      }),
    ).toBeNull();
  },
);

test('no ejecuta lecturas globales cuando falta contexto obligatorio', async () => {
  await expect(repository.findByOwner({ ...scope, bookingId: 'x' })).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
  });
  await expect(repository.listEffectiveByTrip({ tripId: scope.tripId })).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
  });
});

test('conflicto en un solo asiento revierte la solicitud completa', async () => {
  await repository.reserve(scope, async () => prepared({ seatIds: ['02'] }));
  await expect(repository.reserve(scope, async () => prepared())).rejects.toMatchObject({
    code: 'BOOKING_SEAT_CONFLICT',
  });
  expect(await counts()).toEqual({ bookings: 1, allocations: 1 });
  expect((await repository.listEffectiveByTrip(scope)).map((entry) => entry.seatId)).toEqual([
    '02',
  ]);
});

test('dos tramos adyacentes reutilizan los mismos asientos sin colisionar', async () => {
  await repository.reserve(scope, async () => prepared());
  await repository.reserve(scope, async () => prepared({ fromPosition: 3, toPosition: 4 }));
  expect(await counts()).toEqual({ bookings: 2, allocations: 4 });
});

test.each([{ tripId: 'otro-viaje' }, { cooperativeId: 'otra-cooperativa' }])(
  'separa inventario por viaje y cooperativa: %j',
  async (change) => {
    await repository.reserve(scope, async () => prepared());
    const target = { ...scope, ...change };
    await repository.reserve(target, async () => prepared(change));
    expect(await repository.listEffectiveByTrip(target)).toHaveLength(2);
    expect(await repository.listEffectiveByTrip(scope)).toHaveLength(2);
    expect(await counts()).toEqual({ bookings: 2, allocations: 4 });
  },
);

test('una venta también impide reservar el tramo y una liberación explícita deja de bloquear', async () => {
  const booking = await repository.reserve(scope, async () => prepared());
  // Fixture de estado posterior; no existe aún una API de venta/liberación en este incremento.
  await pool.query("UPDATE booking_seat_allocations SET status = 'SOLD' WHERE booking_id = $1", [
    booking.bookingId,
  ]);
  await expect(repository.reserve(scope, async () => prepared())).rejects.toMatchObject({
    code: 'BOOKING_SEAT_CONFLICT',
  });
  await pool.query('UPDATE booking_seat_allocations SET active = false WHERE booking_id = $1', [
    booking.bookingId,
  ]);
  await repository.reserve(scope, async () => prepared());
  expect(await repository.listEffectiveByTrip(scope)).toHaveLength(2);
});

test('un ID repetido da conflicto sin duplicar la reserva ni sus asientos', async () => {
  const data = prepared({ bookingId: 'id-repetido' });
  await repository.reserve(scope, async () => data);
  await expect(
    repository.reserve({ ...scope, tripId: 'otro-viaje' }, async () =>
      prepared({
        bookingId: 'id-repetido',
        tripId: 'otro-viaje',
      }),
    ),
  ).rejects.toMatchObject({ code: 'BOOKING_ALREADY_EXISTS' });
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('revierte la reserva y el primer asiento si falla la segunda inserción', async () => {
  const failure = new Error('fallo de escritura simulado en el cliente de pruebas');
  const failingPool = {
    connect: async () => {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        query: (sql, params) => {
          if (sql.includes('INSERT INTO booking_seat_allocations') && params[3] === '02')
            throw failure;
          return client.query(sql, params);
        },
      };
    },
  };
  const failingRepository = new PgBookingRepository({ pool: failingPool });
  await expect(failingRepository.reserve(scope, async () => prepared())).rejects.toBe(failure);
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
  // Una conexión devuelta al pool no queda en transacción fallida ni conserva bloqueos.
  await repository.reserve(scope, async () => prepared());
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('rechaza un contexto preparado para otro viaje y revierte su transacción', async () => {
  await expect(
    repository.reserve(scope, async () => prepared({ tripId: 'ajeno' })),
  ).rejects.toMatchObject({ code: 'BOOKING_VALIDATION_ERROR' });
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});

test('rechaza datos que no fueron aceptados y no guarda importes o estado parciales', async () => {
  const data = prepared();
  data.input.summaryAccepted = false;
  await expect(repository.reserve(scope, async () => data)).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
  });
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});

test('dos transacciones se serializan y solo una reserva el mismo tramo', async () => {
  let enter;
  let release;
  const entered = new Promise((resolve) => {
    enter = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const first = repository.reserve(scope, async () => {
    enter();
    await gate;
    return prepared();
  });
  await entered;
  const second = repository.reserve(scope, async () => prepared());
  const settled = Promise.allSettled([first, second]);
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
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const rejected = results.find((result) => result.status === 'rejected');
  expect(rejected.reason).toMatchObject({ code: 'BOOKING_SEAT_CONFLICT' });
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('la migración es reversible y reaplicable sin editar migraciones anteriores', async () => {
  const target = '1793820000000-install-bookings';
  const { rows: applied } = await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC');
  expect(applied.map(({ name }) => name)).toContain(target);
  for (const { name } of applied) {
    if (name === target) break;
    runMigration('down');
    expect(
      (await pool.query('SELECT name FROM pgmigrations')).rows.map((row) => row.name),
    ).not.toContain(name);
  }
  runMigration('down');
  try {
    const { rows } = await pool.query(
      "SELECT to_regclass('bookings') AS bookings, to_regclass('booking_seat_allocations') AS allocations",
    );
    expect(rows[0]).toEqual({ bookings: null, allocations: null });
  } finally {
    runMigration();
  }
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});
