const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const { busRequest, fleetFixtures } = require('../../helpers/fleet-bus');

const THIS_MIGRATION = '1793760000000-protect-bus-seats';
const RESTRICT_VIOLATION = '23001';
let pool, repository, fixtures;

const seatsOf = async (busId) =>
  (await pool.query('SELECT * FROM bus_seats WHERE bus_id = $1 ORDER BY label', [busId])).rows;

const appliedNames = async () =>
  (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC')).rows.map(({ name }) => name);

async function registerBus() {
  const request = busRequest({ ...fixtures.first, data: { vipSeatKeys: ['deck-1-0-1'] } });
  await repository.create(request);
  return request.id;
}

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgBusRepository(pool);
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE bus_photos, bus_seats, buses, bus_groups, cooperatives CASCADE');
  fixtures = await fleetFixtures(pool);
});
afterAll(async () => {
  if (pool) await pool.end();
});

test('el alta crea los asientos igual que antes', async () => {
  const busId = await registerBus();
  const seats = await seatsOf(busId);
  expect(seats).toHaveLength(42);
  expect(seats.filter((seat) => seat.category === 'VIP')).toHaveLength(1);
});

test.each([
  ['offered', false],
  ['category', 'NORMAL'],
  ['label', 999],
  ['layout_seat_key', 'deck-9-9-9'],
  ['row_index', 99],
])('rechaza cambiar %s de un asiento registrado', async (field, value) => {
  const busId = await registerBus();
  const before = await seatsOf(busId);
  await expect(
    pool.query(`UPDATE bus_seats SET ${field} = $1 WHERE id = $2`, [value, before[1].id]),
  ).rejects.toMatchObject({ code: RESTRICT_VIOLATION });
  expect(await seatsOf(busId)).toEqual(before);
});

test('rechaza una actualización que no cambia valores', async () => {
  const busId = await registerBus();
  await expect(
    pool.query('UPDATE bus_seats SET offered = offered WHERE bus_id = $1', [busId]),
  ).rejects.toMatchObject({ code: RESTRICT_VIOLATION });
});

test('rechaza borrar asientos, también en cascada desde el bus', async () => {
  const busId = await registerBus();
  const before = await seatsOf(busId);
  await expect(
    pool.query('DELETE FROM bus_seats WHERE id = $1', [before[0].id]),
  ).rejects.toMatchObject({ code: RESTRICT_VIOLATION });
  await expect(pool.query('DELETE FROM buses WHERE id = $1', [busId])).rejects.toMatchObject({
    code: RESTRICT_VIOLATION,
  });
  expect(await seatsOf(busId)).toEqual(before);
});

test('la migración se revierte y reaplica sin alterar asientos', async () => {
  const busId = await registerBus();
  const before = await seatsOf(busId);
  const applied = await appliedNames();
  expect(applied[0]).toBe(THIS_MIGRATION);
  try {
    runMigration('down');
    expect(await appliedNames()).not.toContain(THIS_MIGRATION);
    expect(await seatsOf(busId)).toEqual(before);
  } finally {
    runMigration('up');
  }
  expect(await appliedNames()).toEqual(applied);
  await expect(
    pool.query('UPDATE bus_seats SET offered = false WHERE bus_id = $1', [busId]),
  ).rejects.toMatchObject({ code: RESTRICT_VIOLATION });
});
