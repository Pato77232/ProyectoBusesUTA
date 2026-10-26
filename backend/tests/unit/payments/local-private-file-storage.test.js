const { mkdtemp, readFile, rm, stat } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const LocalPrivateFileStorage = require('../../../src/modules/payments/infrastructure/local-private-file-storage');

describe('LocalPrivateFileStorage', () => {
  let rootDirectory;
  let storage;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'payment-proofs-'));
    storage = new LocalPrivateFileStorage({ rootDirectory });
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  test('guarda los bytes bajo una clave opaca y permite borrarlos de forma idempotente', async () => {
    // Arrange
    const file = { buffer: Buffer.from('private proof') };

    // Act
    const fileKey = await storage.save(file);
    const savedBytes = await readFile(path.join(rootDirectory, fileKey));
    await storage.delete(fileKey);
    await storage.delete(fileKey);

    // Assert
    expect(fileKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(savedBytes).toEqual(file.buffer);
    await expect(stat(path.join(rootDirectory, fileKey))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('rechaza claves que podrían salir del directorio privado', async () => {
    // Act / Assert
    await expect(storage.delete('../secreto')).rejects.toThrow('La clave del archivo no es válida.');
  });
});
