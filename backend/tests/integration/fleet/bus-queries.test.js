const { randomUUID } = require('node:crypto');
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
let pool, repository, busQueries, fixtures;

function registerBus(owner, plate, unitNumber, data = {}) {
  const suffix = plate.slice(-4);
  return repository.create(
    busRequest({ ...owner, data: { plate, vin: `VIN${suffix}`, unitNumber, ...data } }),
  );
}

async function addGroup(cooperativeId) {
  const { rows } = await pool.query(
    "INSERT INTO bus_groups(cooperative_id,name,category) VALUES($1,'Rancheras','LONG_ROUTE') RETURNING id",
    [cooperativeId],
  );
  return rows[0].id;
}

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgBusRepository(pool);
  busQueries = createFleetModule({
    pool,
    auth,
    env: { BUS_PHOTO_STORAGE_DIR: os.tmpdir() },
  }).busQueries;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE bus_photos, bus_seats, buses, bus_groups, cooperatives CASCADE');
  fixtures = await fleetFixtures(pool);
});
afterAll(async () => {
  if (pool) await pool.end();
});

test('la API pública solo ofrece lecturas', () => {
  expect(Object.keys(busQueries).sort()).toEqual([
    'findByBusGroupId',
    'findByCooperativeId',
    'findById',
  ]);
});

test('findById devuelve el resumen del bus propio sin VIN ni fotos', async () => {
  const bus = await registerBus(fixtures.first, 'TBM-2213', 7);
  await expect(busQueries.findById(bus.id, fixtures.first.cooperativeId)).resolves.toEqual({
    id: bus.id,
    cooperativeId: fixtures.first.cooperativeId,
    busGroupId: fixtures.first.busGroupId,
    plate: 'TBM-2213',
    unitNumber: 7,
    capacity: 42,
  });
});

test('otra cooperativa no puede consultar un bus ajeno', async () => {
  const bus = await registerBus(fixtures.first, 'TBM-2213', 7);
  await expect(busQueries.findById(bus.id, fixtures.second.cooperativeId)).resolves.toBeNull();
});

test('listar por cooperativa solo incluye sus buses, ordenados por unidad', async () => {
  await registerBus(fixtures.first, 'TBM-0010', 10);
  await registerBus(fixtures.first, 'TBM-0002', 2);
  await registerBus(fixtures.second, 'ABC-0001', 1);
  const buses = await busQueries.findByCooperativeId(fixtures.first.cooperativeId);
  expect(buses.map((bus) => bus.unitNumber)).toEqual([2, 10]);
});

test('listar por grupo separa los grupos de la cooperativa', async () => {
  const otherGroupId = await addGroup(fixtures.first.cooperativeId);
  const inGroup = await registerBus(fixtures.first, 'TBM-0001', 1);
  await registerBus(
    { cooperativeId: fixtures.first.cooperativeId, busGroupId: otherGroupId },
    'TBM-0002',
    2,
  );
  const buses = await busQueries.findByBusGroupId(
    fixtures.first.busGroupId,
    fixtures.first.cooperativeId,
  );
  expect(buses.map((bus) => bus.id)).toEqual([inGroup.id]);
});

test('un grupo ajeno no revela sus buses', async () => {
  await registerBus(fixtures.first, 'TBM-0001', 1);
  await expect(
    busQueries.findByBusGroupId(fixtures.first.busGroupId, fixtures.second.cooperativeId),
  ).resolves.toEqual([]);
});

test('sin buses o con identificadores inexistentes responde vacío', async () => {
  const { cooperativeId, busGroupId } = fixtures.first;
  await expect(busQueries.findById(randomUUID(), cooperativeId)).resolves.toBeNull();
  await expect(busQueries.findById('no-es-uuid', cooperativeId)).resolves.toBeNull();
  await expect(busQueries.findByCooperativeId(cooperativeId)).resolves.toEqual([]);
  await expect(busQueries.findByBusGroupId(busGroupId, cooperativeId)).resolves.toEqual([]);
});
