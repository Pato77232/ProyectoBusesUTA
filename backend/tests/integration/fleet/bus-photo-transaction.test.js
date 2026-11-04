const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const createPersist = require('../../../src/modules/fleet/application/persist-bus-with-photos');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const LocalBusPhotoStorage = require('../../../src/modules/fleet/infrastructure/local-bus-photo-storage');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const { busRequest, fleetFixtures } = require('../../helpers/fleet-bus');
const { inspectFleetPhotoOperation } = require('../../../src/modules/fleet');
const { execFileSync } = require('node:child_process');

let pool, fixtures, root, storage, logger;
beforeAll(() => {
  runMigration();
  pool = testPool();
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE bus_photos, bus_seats, buses, bus_groups, cooperatives CASCADE');
  fixtures = await fleetFixtures(pool);
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-photo-db-test-'));
  storage = new LocalBusPhotoStorage({ root });
  logger = { error: jest.fn() };
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});
afterAll(async () => {
  if (pool) await pool.end();
});
const request = () => ({
  ...busRequest(fixtures.first),
  photos: [{ bytes: Buffer.from('fixture de transporte validado'), contentType: 'image/png' }],
});
const persist = (repository = new PgBusRepository(pool)) =>
  createPersist({ repository, storage, logger });

async function verifyStored(input) {
  const photos = (
    await pool.query(
      'SELECT storage_key, size FROM bus_photos WHERE bus_id=$1 AND cooperative_id=$2',
      [input.id, input.cooperativeId],
    )
  ).rows;
  expect(photos).toHaveLength(1);
  expect(
    await fs.readFile(path.join(root, 'buses', input.id, 'photos', photos[0].storage_key)),
  ).toEqual(input.photos[0].bytes);
  expect(
    (
      await pool.query('SELECT id FROM bus_seats WHERE bus_id=$1 AND cooperative_id=$2', [
        input.id,
        input.cooperativeId,
      ])
    ).rows,
  ).toHaveLength(42);
}

test('alta confirmada conserva archivos y referencias después de reconstruir adaptador', async () => {
  const input = request();
  await persist()(input);
  storage = new LocalBusPhotoStorage({ root });
  await verifyStored(input);
  expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
});

test('conflicto SQL limpia únicamente fotos del intento rechazado', async () => {
  const first = request();
  await persist()(first);
  const second = request();
  await expect(persist()(second)).rejects.toMatchObject({ code: 'BUS_ALREADY_EXISTS' });
  await verifyStored(first);
  expect(await fs.readdir(path.join(root, 'buses'))).toEqual([first.id]);
  expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
});

test('grupo ajeno revierte SQL y limpia archivos de la operación', async () => {
  const input = request();
  input.data.busGroupId = fixtures.second.busGroupId;
  await expect(persist()(input)).rejects.toMatchObject({ code: 'BUS_GROUP_NOT_FOUND' });
  expect((await pool.query('SELECT id FROM buses')).rows).toEqual([]);
  expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
});

test('fallo de promoción revierte filas y retira ambos directorios propios', async () => {
  storage = new LocalBusPhotoStorage({
    root,
    io: {
      ...fs,
      rename: async () => {
        throw new Error('Disco fallido');
      },
    },
  });
  await expect(persist()(request())).rejects.toThrow('Disco fallido');
  expect((await pool.query('SELECT id FROM buses')).rows).toEqual([]);
  expect((await pool.query('SELECT id FROM bus_seats')).rows).toEqual([]);
  expect((await pool.query('SELECT id FROM bus_photos')).rows).toEqual([]);
  expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
  expect(await fs.readdir(path.join(root, 'buses'))).toEqual([]);
});

test('COMMIT aplicado con confirmación perdida conserva fotos y referencias reconciliables', async () => {
  const uncertainPool = {
    connect: async () => {
      const client = await pool.connect();
      return {
        query: async (sql, values) => {
          const result = await client.query(sql, values);
          if (sql === 'COMMIT') throw new Error('Confirmación perdida');
          return result;
        },
        release: (discard) => client.release(discard),
      };
    },
  };
  const input = request();
  await expect(persist(new PgBusRepository(uncertainPool))(input)).rejects.toMatchObject({
    code: 'BUS_REGISTRATION_COMMIT_UNKNOWN',
  });
  await verifyStored(input);
  expect(logger.error).toHaveBeenCalledWith(
    expect.objectContaining({ busId: input.id, event: 'fleet.bus_photo_commit_unknown' }),
  );
  const owner = JSON.parse(
    await fs.readFile(path.join(root, 'buses', input.id, 'operation.json'), 'utf8'),
  );
  expect((await storage.inspectOperation(owner))[0].files.every((file) => file.complete)).toBe(
    true,
  );
});

test('COMMIT no aplicado con resultado incierto también conserva fotos hasta comprobar BD', async () => {
  const uncertainPool = {
    connect: async () => {
      const client = await pool.connect();
      return {
        query: async (sql, values) => {
          if (sql === 'COMMIT') throw new Error('Conexión perdida antes de ejecutar');
          return client.query(sql, values);
        },
        release: () => client.release(true),
      };
    },
  };
  const input = request();
  await expect(persist(new PgBusRepository(uncertainPool))(input)).rejects.toMatchObject({
    code: 'BUS_REGISTRATION_COMMIT_UNKNOWN',
  });
  expect((await pool.query('SELECT id FROM buses WHERE id=$1', [input.id])).rows).toEqual([]);
  expect(await fs.readdir(path.join(root, 'buses'))).toEqual([input.id]);
  const owner = JSON.parse(
    await fs.readFile(path.join(root, 'buses', input.id, 'operation.json'), 'utf8'),
  );
  expect((await storage.inspectOperation(owner))[0].files.every((file) => file.complete)).toBe(
    true,
  );
});

test('SQL fallido y limpieza fallida conservan un temporal privado y registran incidente', async () => {
  storage = new LocalBusPhotoStorage({
    root,
    io: {
      ...fs,
      rm: async () => {
        throw new Error('Permiso denegado');
      },
    },
  });
  const input = request();
  input.data.busGroupId = randomUUID();
  await expect(persist()(input)).rejects.toMatchObject({
    code: 'BUS_PHOTO_STORAGE_ERROR',
    cleanupFailed: true,
  });
  expect((await pool.query('SELECT id FROM buses')).rows).toEqual([]);
  expect(await fs.readdir(path.join(root, '.staging'))).toHaveLength(1);
  expect(logger.error).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'fleet.bus_photo_cleanup_failed' }),
  );
});

test('diagnóstico CLI contrasta BD y archivos sin modificarlos ni imprimir rutas privadas', async () => {
  const input = request();
  await persist()(input);
  const owner = JSON.parse(
    await fs.readFile(path.join(root, 'buses', input.id, 'operation.json'), 'utf8'),
  );
  const stdout = execFileSync(
    process.execPath,
    [
      path.resolve('scripts/inspect-fleet-photo-operation.js'),
      input.id,
      owner.operationId,
      input.cooperativeId,
    ],
    {
      env: { ...process.env, BUS_PHOTO_STORAGE_DIR: root },
      encoding: 'utf8',
    },
  );
  expect(JSON.parse(stdout)).toMatchObject({
    busExists: true,
    referencedPhotos: 1,
    matches: true,
    action: 'PRESERVE',
  });
  expect(stdout).not.toContain(root);
  await verifyStored(input);
});

test('diagnóstico ante contexto ajeno exige revisión manual y nunca ordena borrar', async () => {
  const input = request();
  await persist()(input);
  const owner = JSON.parse(
    await fs.readFile(path.join(root, 'buses', input.id, 'operation.json'), 'utf8'),
  );
  const report = await inspectFleetPhotoOperation({
    pool,
    root,
    ...owner,
    cooperativeId: fixtures.second.cooperativeId,
  });
  expect(report).toMatchObject({ busExists: false, matches: false, action: 'MANUAL_REVIEW' });
  await verifyStored(input);
});
