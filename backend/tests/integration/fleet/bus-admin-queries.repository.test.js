const { randomUUID } = require('node:crypto');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const { busRequest, fleetFixtures } = require('../../helpers/fleet-bus');

let pool;
let repository;
let fixtures;

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

test('lista só buses del tenant autenticado, con grupo y número de fotos', async () => {
  const first = busRequest({
    ...fixtures.first,
    photos: [{ fileKey: randomUUID(), contentType: 'image/png', size: 4 }],
  });
  await repository.create(first);

  await expect(repository.listAdminBuses(fixtures.first.cooperativeId)).resolves.toEqual([
    {
      id: first.id,
      plate: 'TBM-0013',
      unitNumber: 1,
      busGroupId: fixtures.first.busGroupId,
      busGroupName: 'Rutas largas',
      capacity: 42,
      photoCount: 1,
    },
  ]);
  await expect(repository.listAdminBuses(fixtures.second.cooperativeId)).resolves.toEqual([]);
});

test('ficha incluye snapshot y asientos ACCESSIBLE sin exponer metadatos de almacenamiento', async () => {
  const request = busRequest({
    ...fixtures.first,
    data: { accessibleSeatKeys: ['deck-1-0-0'] },
    photos: [{ fileKey: randomUUID(), contentType: 'image/png', size: 4 }],
  });
  await repository.create(request);

  const detail = await repository.findAdminDetails(request.id, fixtures.first.cooperativeId);
  expect(detail).toMatchObject({
    id: request.id,
    plate: 'TBM-0013',
    vin: 'VIN0013',
    busGroup: { id: fixtures.first.busGroupId, name: 'Rutas largas' },
    seatLayout: { id: 'SINGLE_DECK_2_2', version: 1, snapshot: request.configuration.layout },
    capacity: 41,
  });
  expect(detail.seats).toHaveLength(42);
  expect(detail.seats.find((seat) => seat.layoutSeatKey === 'deck-1-0-0')).toMatchObject({
    category: 'ACCESSIBLE',
    offered: false,
  });
  expect(detail.photos).toHaveLength(1);
  expect(JSON.stringify(detail)).not.toContain('storage_key');
  await expect(
    repository.findAdminDetails(request.id, fixtures.second.cooperativeId),
  ).resolves.toBe(null);
});

test('resuelve el archivo de foto solo por bus, foto y cooperative_id correspondientes', async () => {
  const fileKey = randomUUID();
  const request = busRequest({
    ...fixtures.first,
    photos: [{ fileKey, contentType: 'image/png', size: 4 }],
  });
  const created = await repository.create(request);
  const photoId = created.photos[0].id;

  await expect(
    repository.findPhotoById({
      busId: request.id,
      photoId,
      cooperativeId: fixtures.first.cooperativeId,
    }),
  ).resolves.toEqual({ fileKey, contentType: 'image/png', size: 4 });
  await expect(
    repository.findPhotoById({
      busId: request.id,
      photoId,
      cooperativeId: fixtures.second.cooperativeId,
    }),
  ).resolves.toBeNull();
});
