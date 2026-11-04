const { randomUUID } = require('node:crypto');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const BusRepository = require('../../../src/modules/fleet/domain/bus.repository');
const {
  BusRegistrationCommitUnknownError,
} = require('../../../src/modules/fleet/domain/bus-registration-error');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const { busRequest, fleetFixtures } = require('../../helpers/fleet-bus');

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

async function stored() {
  const result = {};
  for (const table of ['buses', 'bus_seats', 'bus_photos']) {
    result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
  }
  return result;
}

test('guarda bus, snapshot, identidades de asientos y fotos en una transacción', async () => {
  const request = busRequest({
    ...fixtures.first,
    data: { disabledSeatKeys: ['deck-1-0-0', 'deck-1-10-1'] },
  });
  request.photos.push({ fileKey: randomUUID(), contentType: 'image/png', size: 5_000_000 });
  const promote = jest.fn(async () => {
    expect(
      (
        await pool.query('SELECT id FROM buses WHERE id=$1 AND cooperative_id=$2', [
          request.id,
          request.cooperativeId,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  expect(repository).toBeInstanceOf(BusRepository);
  const result = await repository.create(request, { beforeCommit: promote });
  expect(promote).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({
    id: request.id,
    plate: 'TBM-0013',
    vin: 'VIN0013',
    unitNumber: 1,
    capacity: 40,
  });
  expect(result.cooperative_id).toBeUndefined();
  expect(
    result.photos.map(({ contentType, size, order }) => ({ contentType, size, order })),
  ).toEqual([
    { contentType: 'image/jpeg', size: 100, order: 0 },
    { contentType: 'image/png', size: 5_000_000, order: 1 },
  ]);
  for (const photo of result.photos)
    expect(Object.keys(photo).sort()).toEqual(['contentType', 'id', 'order', 'size']);
  const rows = await stored();
  expect(rows.buses).toHaveLength(1);
  expect(rows.buses[0]).toMatchObject({
    cooperative_id: request.cooperativeId,
    plate: 'TBM0013',
    vin: 'VIN0013',
    unit_number: '1',
    capacity: 40,
    seat_layout_snapshot: request.configuration.layout,
  });
  expect(rows.bus_seats).toHaveLength(42);
  expect(rows.bus_photos).toHaveLength(2);
  expect(new Set(rows.bus_seats.map((seat) => seat.id)).size).toBe(42);
  expect(
    rows.bus_seats
      .filter((seat) => !seat.offered)
      .map((seat) => seat.label)
      .sort((a, b) => a - b),
  ).toEqual([1, 42]);
  expect(
    rows.bus_seats.every(
      (seat) => seat.cooperative_id === request.cooperativeId && seat.bus_id === request.id,
    ),
  ).toBe(true);
  expect(
    rows.bus_photos.every(
      (photo) => photo.cooperative_id === request.cooperativeId && photo.bus_id === request.id,
    ),
  ).toBe(true);
});

test('misma plantilla produce asientos de identidad distinta en cada bus', async () => {
  const first = busRequest(fixtures.first);
  const second = busRequest({
    ...fixtures.first,
    data: { plate: 'TBM-0014', vin: 'VIN0014', unitNumber: 2 },
  });
  await repository.create(first);
  await repository.create(second);
  const rows = (await stored()).bus_seats;
  expect(rows).toHaveLength(84);
  expect(new Set(rows.map((seat) => seat.id)).size).toBe(84);
  expect(rows.filter((seat) => seat.label === 1)).toHaveLength(2);
});

test.each(['plate', 'vin', 'unitNumber'])(
  'duplicado de %s es genérico y conserva todas las filas previas',
  async (field) => {
    const first = busRequest(fixtures.first);
    await repository.create(first);
    const before = await stored();
    const duplicate = busRequest({
      ...fixtures.first,
      data: { plate: 'TBM-0099', vin: 'OTHER-VIN', unitNumber: 99, [field]: first.data[field] },
    });
    const promote = jest.fn();
    await expect(repository.create(duplicate, { beforeCommit: promote })).rejects.toMatchObject({
      code: 'BUS_ALREADY_EXISTS',
      message: 'El bus entra en conflicto con un registro existente.',
    });
    expect(promote).not.toHaveBeenCalled();
    expect(await stored()).toEqual(before);
  },
);

test.each(['plate', 'vin'])('%s es único incluso entre cooperativas', async (field) => {
  const first = busRequest(fixtures.first);
  await repository.create(first);
  const duplicate = busRequest({
    ...fixtures.second,
    data: { plate: 'TBM-0099', vin: 'OTHER-VIN', [field]: first.data[field] },
  });
  await expect(repository.create(duplicate)).rejects.toMatchObject({ code: 'BUS_ALREADY_EXISTS' });
  expect((await stored()).buses).toHaveLength(1);
});

test('unidad 01 y 1 colisionan dentro de cooperativa pero unidad 1 es válida en otra', async () => {
  await repository.create(busRequest(fixtures.first));
  const result = await repository.create(
    busRequest({
      ...fixtures.second,
      data: { plate: 'TBM-0099', vin: 'OTHER-VIN', unitNumber: 1 },
    }),
  );
  expect(result.unitNumber).toBe(1);
  expect((await stored()).buses).toHaveLength(2);
});

test.each(['plate', 'vin', 'unitNumber'])(
  'concurrencia de %s: un alta completa y un conflicto, sin asientos/fotos huérfanos',
  async (field) => {
    const first = busRequest(fixtures.first);
    const second = busRequest({
      ...fixtures.first,
      data: { plate: 'TBM-0099', vin: 'OTHER-VIN', unitNumber: 99, [field]: first.data[field] },
    });
    const promote = jest.fn();
    const result = await Promise.allSettled([
      repository.create(first, { beforeCommit: promote }),
      repository.create(second, { beforeCommit: promote }),
    ]);
    expect(result.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
    expect(result.find((entry) => entry.status === 'rejected').reason.code).toBe(
      'BUS_ALREADY_EXISTS',
    );
    const rows = await stored();
    expect(rows.buses).toHaveLength(1);
    expect(rows.bus_seats).toHaveLength(42);
    expect(rows.bus_photos).toHaveLength(1);
    expect(promote).toHaveBeenCalledTimes(1);
  },
);

test.each(['missing', 'other'])('grupo %s se rechaza sin escrituras ni promoción', async (kind) => {
  const request = busRequest({
    ...fixtures.first,
    busGroupId: kind === 'missing' ? randomUUID() : fixtures.second.busGroupId,
  });
  const promote = jest.fn();
  await expect(repository.create(request, { beforeCommit: promote })).rejects.toMatchObject({
    code: 'BUS_GROUP_NOT_FOUND',
    message: 'El grupo de buses no está disponible.',
  });
  expect(await stored()).toEqual({ buses: [], bus_seats: [], bus_photos: [] });
  expect(promote).not.toHaveBeenCalled();
});

test('fallo de promoción revierte todo y libera la transacción para otro intento', async () => {
  const request = busRequest(fixtures.first);
  const failure = new Error('Fallo de promoción de prueba');
  await expect(
    repository.create(request, {
      beforeCommit: async () => {
        throw failure;
      },
    }),
  ).rejects.toBe(failure);
  expect(await stored()).toEqual({ buses: [], bus_seats: [], bus_photos: [] });
  await expect(repository.create(request)).resolves.toMatchObject({ id: request.id });
});

test('fallo SQL de asientos revierte el bus sin traducirlo a duplicado de usuario', async () => {
  const repeated = randomUUID();
  const broken = new PgBusRepository(pool, { newId: () => repeated });
  await expect(broken.create(busRequest(fixtures.first))).rejects.toMatchObject({
    code: '23505',
    constraint: 'bus_seats_pkey',
  });
  expect(await stored()).toEqual({ buses: [], bus_seats: [], bus_photos: [] });
});

test('fallo tardío de fotos revierte bus/asientos y conserva registros anteriores', async () => {
  const first = busRequest(fixtures.first);
  await repository.create(first);
  const before = await stored();
  const second = busRequest({
    ...fixtures.first,
    data: { plate: 'TBM-0099', vin: 'OTHER', unitNumber: 99 },
    photos: first.photos,
  });
  await expect(repository.create(second)).rejects.toMatchObject({
    code: '23505',
    constraint: 'bus_photos_storage_key_unique',
  });
  expect(await stored()).toEqual(before);
});

test('pérdida de confirmación tras COMMIT conserva el alta y comunica resultado incierto', async () => {
  const lost = new Error('Confirmación perdida de prueba');
  const uncertainPool = {
    connect: async () => {
      const client = await pool.connect();
      return {
        query: async (sql, values) => {
          const result = await client.query(sql, values);
          if (sql === 'COMMIT') throw lost;
          return result;
        },
        release: (discard) => client.release(discard),
      };
    },
  };
  const request = busRequest(fixtures.first);
  const promote = jest.fn();
  const attempt = new PgBusRepository(uncertainPool).create(request, { beforeCommit: promote });
  await expect(attempt).rejects.toBeInstanceOf(BusRegistrationCommitUnknownError);
  await expect(attempt).rejects.toMatchObject({
    code: 'BUS_REGISTRATION_COMMIT_UNKNOWN',
    busId: request.id,
    cooperativeId: request.cooperativeId,
    cause: lost,
  });
  expect(promote).toHaveBeenCalledTimes(1);
  const rows = await stored();
  expect(rows.buses).toHaveLength(1);
  expect(rows.bus_seats).toHaveLength(42);
  expect(rows.bus_photos).toHaveLength(1);
});

test('SQL parametrizado conserva texto libre sin ejecutar instrucciones del campo', async () => {
  const bodyworkBrand = "Marca'); DROP TABLE buses; --";
  const result = await repository.create(
    busRequest({ ...fixtures.first, data: { bodyworkBrand } }),
  );
  expect(result.bodyworkBrand).toBe(bodyworkBrand);
  expect((await stored()).buses[0].bodywork_brand).toBe(bodyworkBrand);
});
