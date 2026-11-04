const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const { busRequest, fleetFixtures } = require('../../helpers/fleet-bus');

const TARGET = '1793440000000-register-buses';
let pool, repository, fixtures;
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

test('revierte por nombre objetivo, conserva cooperativas/grupos y reaplica sin duplicar migraciones', async () => {
  const groups = (await pool.query('SELECT * FROM bus_groups ORDER BY id')).rows;
  const cooperatives = (await pool.query('SELECT * FROM cooperatives ORDER BY id')).rows;
  const applied = (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC')).rows;
  expect(applied.map((entry) => entry.name)).toContain(TARGET);
  try {
    for (const { name } of applied) {
      runMigration('down');
      if (name === TARGET) break;
    }
    const gone = (
      await pool.query(
        "SELECT to_regclass('buses') AS buses, to_regclass('bus_seats') AS seats, to_regclass('bus_photos') AS photos",
      )
    ).rows[0];
    expect(gone).toEqual({ buses: null, seats: null, photos: null });
    expect((await pool.query('SELECT * FROM bus_groups ORDER BY id')).rows).toEqual(groups);
    expect((await pool.query('SELECT * FROM cooperatives ORDER BY id')).rows).toEqual(cooperatives);
    expect(
      (
        await pool.query(
          "SELECT conname FROM pg_constraint WHERE conname='bus_groups_id_cooperative_unique'",
        )
      ).rows,
    ).toEqual([]);
  } finally {
    runMigration();
  }
  runMigration();
  expect(
    (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map((entry) => entry.name),
  ).toEqual(applied.map((entry) => entry.name).reverse());
  const back = (
    await pool.query(
      "SELECT to_regclass('buses') AS buses, to_regclass('bus_seats') AS seats, to_regclass('bus_photos') AS photos",
    )
  ).rows[0];
  expect(back).toEqual({ buses: 'buses', seats: 'bus_seats', photos: 'bus_photos' });
  await expect(repository.create(busRequest(fixtures.first))).resolves.toMatchObject({
    capacity: 42,
  });
});

test('FK de grupo impide asociar un bus a un grupo de otra cooperativa incluso por SQL', async () => {
  const request = busRequest(fixtures.first);
  await repository.create(request);
  await expect(
    pool.query('UPDATE buses SET bus_group_id=$1 WHERE id=$2 AND cooperative_id=$3', [
      fixtures.second.busGroupId,
      request.id,
      request.cooperativeId,
    ]),
  ).rejects.toMatchObject({ code: '23503', constraint: 'buses_bus_group_tenant_fk' });
  await expect(
    pool.query('DELETE FROM bus_groups WHERE id=$1 AND cooperative_id=$2', [
      fixtures.first.busGroupId,
      fixtures.first.cooperativeId,
    ]),
  ).rejects.toMatchObject({ code: '23503', constraint: 'buses_bus_group_tenant_fk' });
  expect(
    (
      await pool.query('SELECT bus_group_id FROM buses WHERE id=$1 AND cooperative_id=$2', [
        request.id,
        request.cooperativeId,
      ])
    ).rows[0].bus_group_id,
  ).toBe(fixtures.first.busGroupId);
});

test.each(['bus_seats', 'bus_photos'])(
  'FK de %s mantiene pertenencia al bus/cooperativa sin cascada entre inquilinos',
  async (table) => {
    const request = busRequest(fixtures.first);
    await repository.create(request);
    const before = (
      await pool.query(`SELECT * FROM ${table} WHERE bus_id=$1 AND cooperative_id=$2 ORDER BY id`, [
        request.id,
        request.cooperativeId,
      ])
    ).rows;
    await expect(
      pool.query(`UPDATE ${table} SET cooperative_id=$1 WHERE bus_id=$2 AND cooperative_id=$3`, [
        fixtures.second.cooperativeId,
        request.id,
        request.cooperativeId,
      ]),
    ).rejects.toMatchObject({ code: '23503' });
    expect(
      (
        await pool.query(
          `SELECT * FROM ${table} WHERE bus_id=$1 AND cooperative_id=$2 ORDER BY id`,
          [request.id, request.cooperativeId],
        )
      ).rows,
    ).toEqual(before);
  },
);

test.each([
  ['plate', 'TBM-0013'],
  ['plate', 'tbm0013'],
  ['vin', 'lowercase'],
  ['vin', '  VIN  '],
  ['unit_number', 0],
  ['unit_number', '9007199254740992'],
  ['capacity', 0],
  ['bodywork_brand', ' '],
  ['color', ' '],
])('restricciones rechazan %s=%j sin modificar la fila', async (field, value) => {
  const request = busRequest(fixtures.first);
  await repository.create(request);
  const before = (
    await pool.query('SELECT * FROM buses WHERE id=$1 AND cooperative_id=$2', [
      request.id,
      request.cooperativeId,
    ])
  ).rows;
  await expect(
    pool.query(`UPDATE buses SET ${field}=$1 WHERE id=$2 AND cooperative_id=$3`, [
      value,
      request.id,
      request.cooperativeId,
    ]),
  ).rejects.toMatchObject({ code: '23514' });
  expect(
    (
      await pool.query('SELECT * FROM buses WHERE id=$1 AND cooperative_id=$2', [
        request.id,
        request.cooperativeId,
      ])
    ).rows,
  ).toEqual(before);
});

test.each([
  ['bus_seats', 'category', 'OTRA'],
  ['bus_seats', 'label', 0],
  ['bus_photos', 'size', 5_000_001],
  ['bus_photos', 'sort_order', 10],
  ['bus_photos', 'content_type', 'application/pdf'],
])('restricciones de %s rechazan %s=%j', async (table, field, value) => {
  const request = busRequest(fixtures.first);
  await repository.create(request);
  await expect(
    pool.query(`UPDATE ${table} SET ${field}=$1 WHERE bus_id=$2 AND cooperative_id=$3`, [
      value,
      request.id,
      request.cooperativeId,
    ]),
  ).rejects.toMatchObject({ code: '23514' });
});

test('identificadores de posición y etiquetas no se repiten dentro del bus', async () => {
  const request = busRequest(fixtures.first);
  await repository.create(request);
  const seats = (
    await pool.query(
      'SELECT * FROM bus_seats WHERE bus_id=$1 AND cooperative_id=$2 ORDER BY label',
      [request.id, request.cooperativeId],
    )
  ).rows;
  await expect(
    pool.query('UPDATE bus_seats SET layout_seat_key=$1 WHERE id=$2 AND cooperative_id=$3', [
      seats[0].layout_seat_key,
      seats[1].id,
      request.cooperativeId,
    ]),
  ).rejects.toMatchObject({ code: '23505', constraint: 'bus_seats_position_unique' });
  await expect(
    pool.query('UPDATE bus_seats SET label=$1 WHERE id=$2 AND cooperative_id=$3', [
      seats[0].label,
      seats[1].id,
      request.cooperativeId,
    ]),
  ).rejects.toMatchObject({ code: '23505', constraint: 'bus_seats_label_unique' });
  await expect(
    pool.query(
      'UPDATE bus_seats SET row_index=$1,column_index=$2 WHERE id=$3 AND cooperative_id=$4',
      [seats[0].row_index, seats[0].column_index, seats[1].id, request.cooperativeId],
    ),
  ).rejects.toMatchObject({ code: '23505', constraint: 'bus_seats_coordinates_unique' });
  expect(
    (
      await pool.query(
        'SELECT * FROM bus_seats WHERE bus_id=$1 AND cooperative_id=$2 ORDER BY label',
        [request.id, request.cooperativeId],
      )
    ).rows,
  ).toEqual(seats);
});

test('no hay claves foráneas hacia tablas de reservas/viajes nuevas', async () => {
  const references = (
    await pool.query(`SELECT c.confrelid::regclass::text AS target FROM pg_constraint c
    WHERE c.contype='f' AND c.conrelid IN ('buses'::regclass,'bus_seats'::regclass,'bus_photos'::regclass)`)
  ).rows;
  expect(new Set(references.map((entry) => entry.target))).toEqual(
    new Set(['cooperatives', 'bus_groups', 'buses']),
  );
});
