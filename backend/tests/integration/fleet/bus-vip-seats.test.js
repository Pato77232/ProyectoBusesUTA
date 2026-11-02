const os = require('node:os');
const { createFleetModule } = require('../../../src/modules/fleet');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const { busRequest, fleetFixtures } = require('../../helpers/fleet-bus');

const passThrough = (_req, _res, next) => next();
const auth = {
  authenticate: passThrough,
  authorize: () => passThrough,
  csrfProtection: passThrough,
};
const FIRST_KEY = 'deck-1-0-0';
const SECOND_KEY = 'deck-1-0-1';
const THIS_MIGRATION = '1793640000000-allow-vip-bus-seats';
let pool, repository, seatQueries, fixtures;

const registerBus = (owner, data = {}) => repository.create(busRequest({ ...owner, data }));

async function vipKeys(bus, owner) {
  const { seats } = await seatQueries.listByBus({
    busId: bus.id,
    cooperativeId: owner.cooperativeId,
  });
  return seats.filter((seat) => seat.category === 'VIP').map((seat) => seat.layoutSeatKey);
}

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgBusRepository(pool);
  seatQueries = createFleetModule({
    pool,
    auth,
    env: { BUS_PHOTO_STORAGE_DIR: os.tmpdir() },
  }).seatQueries;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE bus_photos, bus_seats, buses, bus_groups, cooperatives CASCADE');
  fixtures = await fleetFixtures(pool);
});
afterAll(async () => {
  if (pool) await pool.end();
});

test('guarda y entrega como VIP solo los asientos marcados', async () => {
  const bus = await registerBus(fixtures.first, { vipSeatKeys: [FIRST_KEY] });
  await expect(vipKeys(bus, fixtures.first)).resolves.toEqual([FIRST_KEY]);
});

test('un alta sin marcas deja todos los asientos en NORMAL', async () => {
  const bus = await registerBus(fixtures.first);
  await expect(vipKeys(bus, fixtures.first)).resolves.toEqual([]);
});

test('dos buses con la misma plantilla conservan asientos VIP distintos', async () => {
  const first = await registerBus(fixtures.first, { vipSeatKeys: [FIRST_KEY] });
  const second = await registerBus(fixtures.second, {
    plate: 'TBM-0014',
    vin: 'VIN0014',
    vipSeatKeys: [SECOND_KEY],
  });
  await expect(vipKeys(first, fixtures.first)).resolves.toEqual([FIRST_KEY]);
  await expect(vipKeys(second, fixtures.second)).resolves.toEqual([SECOND_KEY]);
});

test('la base rechaza una categoría fuera del contrato', async () => {
  const bus = await registerBus(fixtures.first);
  await expect(
    pool.query("UPDATE bus_seats SET category = 'OTRA' WHERE bus_id = $1", [bus.id]),
  ).rejects.toMatchObject({ code: '23514' });
});

test('la migración conserva los buses existentes y no degrada asientos VIP al revertir', async () => {
  const normal = await registerBus(fixtures.first);
  const applied = (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC')).rows;
  expect(applied[0].name).toBe(THIS_MIGRATION);
  runMigration('down');
  try {
    await expect(vipKeys(normal, fixtures.first)).resolves.toEqual([]);
  } finally {
    runMigration('up');
  }
  const vip = await registerBus(fixtures.second, {
    plate: 'TBM-0014',
    vin: 'VIN0014',
    vipSeatKeys: [FIRST_KEY],
  });
  expect(() => runMigration('down')).toThrow();
  await expect(vipKeys(vip, fixtures.second)).resolves.toEqual([FIRST_KEY]);
});
