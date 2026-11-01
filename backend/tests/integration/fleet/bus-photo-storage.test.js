const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const LocalBusPhotoStorage = require('../../../src/modules/fleet/infrastructure/local-bus-photo-storage');
const BusPhotoStorage = require('../../../src/modules/fleet/domain/bus-photo-storage');

let root, busId, storage;
const photo = (bytes = Buffer.from('bytes ya validados por transporte')) => ({
  bytes,
  contentType: 'image/png',
});
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-photo-test-'));
  busId = randomUUID();
  storage = new LocalBusPhotoStorage({ root });
});
afterEach(async () => {
  // root procede únicamente de mkdtemp; no utiliza configuración ni fotos reales.
  await fs.rm(root, { recursive: true, force: true });
});

test('prepara y promueve todos los bytes sin conservar nombres ni rutas del cliente', async () => {
  const photos = [photo(), photo(Buffer.alloc(5_000_000, 7))];
  photos[0].originalName = '../../otra-cooperativa.png';
  expect(storage).toBeInstanceOf(BusPhotoStorage);
  const session = await storage.prepare({ busId, photos });
  expect(await storage.inspectOperation({ busId, operationId: session.operationId })).toEqual([
    {
      state: 'staged',
      files: session.references.map(({ fileKey }) => ({ fileKey, complete: true })),
    },
  ]);
  await session.promote();
  expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
  for (const [index, reference] of session.references.entries())
    expect(await fs.readFile(path.join(root, 'buses', busId, 'photos', reference.fileKey))).toEqual(
      photos[index].bytes,
    );
  expect(JSON.stringify(session.references)).not.toContain('originalName');
  expect(await fs.readdir(root)).toEqual(expect.arrayContaining(['.staging', 'buses']));
});

test('una nueva instancia conserva archivos promovidos y permite inspección solo lectura', async () => {
  const session = await storage.prepare({ busId, photos: [photo()] });
  await session.promote();
  storage = new LocalBusPhotoStorage({ root });
  const report = await storage.inspectOperation({ busId, operationId: session.operationId });
  expect(report).toEqual([
    { state: 'promoted', files: [{ fileKey: session.references[0].fileKey, complete: true }] },
  ]);
  expect(await storage.inspectOperation({ busId, operationId: session.operationId })).toEqual(
    report,
  );
});

test.each([0, 5_000_001])('rechaza tamaño %s antes de crear temporales', async (size) => {
  await expect(
    storage.prepare({ busId, photos: [photo(Buffer.alloc(size))] }),
  ).rejects.toMatchObject({
    code: 'VALIDATION_ERROR',
  });
  expect(await fs.readdir(root)).toEqual([]);
});

test.each([0, 11])('rechaza cantidad %s antes de escribir', async (count) => {
  await expect(
    storage.prepare({ busId, photos: Array.from({ length: count }, () => photo()) }),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await fs.readdir(root)).toEqual([]);
});

test('admite diez archivos sin colisiones y calcula orden/tamaño', async () => {
  const session = await storage.prepare({
    busId,
    photos: Array.from({ length: 10 }, () => photo()),
  });
  expect(session.references).toHaveLength(10);
  expect(new Set(session.references.map((reference) => reference.fileKey)).size).toBe(10);
  expect(session.references.map((reference) => reference.order)).toEqual([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  ]);
  await session.discard();
  await session.discard();
  await expect(session.promote()).rejects.toThrow();
});

test('fallo de escritura de segunda foto limpia solo el temporal de su operación', async () => {
  let writes = 0;
  const io = {
    ...fs,
    writeFile: async (...args) => {
      if (Buffer.isBuffer(args[1]) && ++writes === 2) throw new Error('Disco de prueba lleno');
      return fs.writeFile(...args);
    },
  };
  storage = new LocalBusPhotoStorage({ root, io });
  await expect(storage.prepare({ busId, photos: [photo(), photo()] })).rejects.toMatchObject({
    code: 'BUS_PHOTO_STORAGE_ERROR',
    cleanupFailed: false,
  });
  expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
  expect(await fs.readdir(path.join(root, 'buses'))).toEqual([]);
});

test('fallo de promoción conserva temporal hasta compensar y no toca otro bus', async () => {
  const other = await storage.prepare({ busId: randomUUID(), photos: [photo()] });
  await other.promote();
  storage = new LocalBusPhotoStorage({
    root,
    io: {
      ...fs,
      rename: async () => {
        throw new Error('Fallo de disco');
      },
    },
  });
  const session = await storage.prepare({ busId, photos: [photo()] });
  await expect(session.promote()).rejects.toThrow('Fallo de disco');
  await session.discard();
  expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
  expect(await fs.readdir(path.join(root, 'buses'))).toHaveLength(1);
});

test('no sobreescribe ni limpia un destino preexistente aunque esté vacío', async () => {
  const first = await storage.prepare({ busId, photos: [photo()] });
  await first.promote();
  const original = await fs.readFile(path.join(root, 'buses', busId, 'operation.json'));
  const second = await storage.prepare({ busId, photos: [photo()] });
  await expect(second.promote()).rejects.toMatchObject({ code: 'EEXIST' });
  await second.discard();
  expect(await fs.readFile(path.join(root, 'buses', busId, 'operation.json'))).toEqual(original);
});

test('no adopta un temporal preexistente con un UUID repetido', async () => {
  const operationId = randomUUID();
  storage = new LocalBusPhotoStorage({ root, newId: () => operationId });
  const first = await storage.prepare({ busId, photos: [photo()] });
  await expect(storage.prepare({ busId, photos: [photo()] })).rejects.toMatchObject({
    code: 'BUS_PHOTO_STORAGE_ERROR',
  });
  expect((await storage.inspectOperation({ busId, operationId }))[0].files[0].complete).toBe(true);
  await first.discard();
});

test('limpieza fallida queda explícita y preserva evidencia para soporte', async () => {
  storage = new LocalBusPhotoStorage({
    root,
    io: {
      ...fs,
      writeFile: async () => {
        throw new Error('Escritura fallida');
      },
      rm: async () => {
        throw new Error('Limpieza fallida');
      },
    },
  });
  await expect(storage.prepare({ busId, photos: [photo()] })).rejects.toMatchObject({
    code: 'BUS_PHOTO_STORAGE_ERROR',
    cleanupFailed: true,
    busId,
  });
  expect(await fs.readdir(path.join(root, '.staging'))).toHaveLength(1);
});

test.each(['../ajeno', 'C:\\fuera', '', null])('rechaza busId %j sin escrituras', async (id) => {
  await expect(storage.prepare({ busId: id, photos: [photo()] })).rejects.toThrow();
  expect(await fs.readdir(root)).toEqual([]);
});

test('no acepta directorios de almacenamiento sustituidos por archivos', async () => {
  await fs.writeFile(path.join(root, '.staging'), 'ajeno');
  await expect(storage.prepare({ busId, photos: [photo()] })).rejects.toMatchObject({
    code: 'BUS_PHOTO_STORAGE_ERROR',
  });
  expect(await fs.readFile(path.join(root, '.staging'), 'utf8')).toBe('ajeno');
});

test('inspección rechaza operación distinta y no altera archivos', async () => {
  const session = await storage.prepare({ busId, photos: [photo()] });
  await session.promote();
  await expect(storage.inspectOperation({ busId, operationId: randomUUID() })).rejects.toThrow(
    'no coincide',
  );
  expect(
    (await storage.inspectOperation({ busId, operationId: session.operationId }))[0].files[0]
      .complete,
  ).toBe(true);
});
