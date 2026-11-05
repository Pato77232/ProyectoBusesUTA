const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const LocalBusPhotoStorage = require('../../../src/modules/fleet/infrastructure/local-bus-photo-storage');

const BUS_ID = '11111111-1111-4111-8111-111111111111';
const FILE_KEY = '33333333-3333-4333-8333-333333333333';

test('lee una foto promovida por identificadores opacos y comprueba su tamaño', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-photo-read-'));
  const storage = new LocalBusPhotoStorage({ root });
  const bytes = Buffer.from('PNG!');
  try {
    const photosDirectory = path.join(root, 'buses', BUS_ID, 'photos');
    await fs.mkdir(photosDirectory, { recursive: true });
    await fs.writeFile(path.join(photosDirectory, FILE_KEY), bytes);

    await expect(
      storage.read({ busId: BUS_ID, fileKey: FILE_KEY, size: bytes.length }),
    ).resolves.toEqual(bytes);
    await expect(storage.read({ busId: BUS_ID, fileKey: FILE_KEY, size: 3 })).rejects.toMatchObject(
      {
        code: 'BUS_PHOTO_STORAGE_ERROR',
      },
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('rechaza identificadores de archivo que no sean UUID', async () => {
  const storage = new LocalBusPhotoStorage({ root: path.join(os.tmpdir(), 'unused-fleet-photo') });

  await expect(storage.read({ busId: BUS_ID, fileKey: '../photo.png', size: 4 })).rejects.toThrow(
    'Identificador interno inválido.',
  );
});
