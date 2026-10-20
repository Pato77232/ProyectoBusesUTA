const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const PgBusGroupRepository = require('../../../src/modules/fleet/infrastructure/pg-bus-group.repository');
const { createBusGroupData } = require('../../../src/modules/fleet/domain/bus-group');

let pool;
let repository;
let coopA;
let coopB;

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgBusGroupRepository(pool);
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE bus_groups, cooperatives CASCADE');
  coopA = (
    await pool.query("INSERT INTO cooperatives(name, ruc) VALUES ('Coop A', '0011111111111') RETURNING id")
  ).rows[0].id;
  coopB = (
    await pool.query("INSERT INTO cooperatives(name, ruc) VALUES ('Coop B', '0022222222222') RETURNING id")
  ).rows[0].id;
});

afterAll(async () => {
  if (pool) await pool.end();
});

test('crea y lista grupos por cooperativa', async () => {
  const data = createBusGroupData({ name: '  Rutas largas  ', category: '  LONG_ROUTE  ' });
  const created = await repository.create(coopA, data);
  expect(created).toMatchObject({ name: 'Rutas largas', category: 'LONG_ROUTE' });
  const list = await repository.listByCooperative(coopA);
  expect(list).toHaveLength(1);
  expect(list[0].id).toBe(created.id);
});

test('aislamiento: dos cooperativas, cada una solo ve sus grupos', async () => {
  await repository.create(coopA, createBusGroupData({ name: 'Grupo A', category: 'CANTONAL' }));
  await repository.create(coopB, createBusGroupData({ name: 'Grupo B', category: 'URBAN_RURAL' }));
  const listA = await repository.listByCooperative(coopA);
  const listB = await repository.listByCooperative(coopB);
  expect(listA.map((g) => g.name)).toEqual(['Grupo A']);
  expect(listB.map((g) => g.name)).toEqual(['Grupo B']);
});

test('duplicado y duplicado por mayúsculas devuelven conflicto con una sola fila', async () => {
  await repository.create(coopA, createBusGroupData({ name: 'Rutas Largas', category: 'LONG_ROUTE' }));
  await expect(
    repository.create(coopA, createBusGroupData({ name: 'rutas largas', category: 'CANTONAL' })),
  ).rejects.toMatchObject({ code: 'BUS_GROUP_ALREADY_EXISTS' });
  const count = await pool.query('SELECT count(*)::int AS count FROM bus_groups WHERE cooperative_id = $1', [coopA]);
  expect(count.rows[0].count).toBe(1);
});

test('dos inserciones concurrentes del mismo nombre: una fila y un conflicto', async () => {
  const data = createBusGroupData({ name: 'Concurrente', category: 'LONG_ROUTE' });
  const results = await Promise.allSettled([
    repository.create(coopA, data),
    repository.create(coopA, data),
  ]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(rejected[0].reason).toMatchObject({ code: 'BUS_GROUP_ALREADY_EXISTS' });
  const count = await pool.query('SELECT count(*)::int AS count FROM bus_groups WHERE cooperative_id = $1', [coopA]);
  expect(count.rows[0].count).toBe(1);
});

test('listado vacío cuando la cooperativa no tiene grupos', async () => {
  const list = await repository.listByCooperative(coopA);
  expect(list).toEqual([]);
});

test('migración sube, baja y vuelve a subir', async () => {
  runMigration('down');
  const gone = await pool.query("SELECT to_regclass('public.bus_groups') AS table_name");
  expect(gone.rows[0].table_name).toBeNull();
  runMigration();
  const back = await pool.query("SELECT to_regclass('public.bus_groups') AS table_name");
  expect(back.rows[0].table_name).toBe('bus_groups');
});
