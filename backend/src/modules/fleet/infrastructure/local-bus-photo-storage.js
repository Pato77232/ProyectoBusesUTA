const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const BusPhotoStorage = require('../domain/bus-photo-storage');
const BusPhotoStorageError = require('../domain/bus-photo-storage-error');
const { createBusPhotoReferences } = require('../domain/bus-photo-references');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function assertId(id) {
  if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Identificador interno inválido.');
}

async function ensureDirectory(io, directory) {
  try {
    await io.mkdir(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const stat = await io.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error('El almacenamiento requiere un directorio propio.');
}

class LocalBusPhotoStorage extends BusPhotoStorage {
  constructor({ root, io = fs, newId = randomUUID }) {
    super();
    if (typeof root !== 'string' || !path.isAbsolute(root))
      throw new Error('BUS_PHOTO_STORAGE_DIR debe ser una ruta absoluta.');
    this.root = path.resolve(root);
    this.io = io;
    this.newId = newId;
  }

  async prepare({ busId, photos }) {
    assertId(busId);
    const operationId = this.newId();
    assertId(operationId);
    // Las referencias y longitudes se comprueban antes de escribir. T4 acredita la imagen.
    const references = createBusPhotoReferences(
      photos.map((photo) => {
        if (!Buffer.isBuffer(photo.bytes)) throw new Error('Se requieren bytes validados.');
        return { fileKey: this.newId(), contentType: photo.contentType, size: photo.bytes.length };
      }),
    );
    const session = this.createSession(busId, operationId, references);
    try {
      await this.io.mkdir(this.root, { recursive: true, mode: 0o700 });
      await ensureDirectory(this.io, this.root);
      await ensureDirectory(this.io, path.join(this.root, '.staging'));
      await ensureDirectory(this.io, path.join(this.root, 'buses'));
      await session.stage(photos);
      return Object.freeze({
        operationId,
        references,
        promote: session.promote,
        discard: session.discard,
      });
    } catch (cause) {
      let cleanupFailed = false;
      try {
        await session.discard();
      } catch {
        cleanupFailed = true;
      }
      throw new BusPhotoStorageError({ busId, operationId, cause, cleanupFailed });
    }
  }

  async read({ busId, fileKey, size }) {
    assertId(busId);
    assertId(fileKey);
    const photosDirectory = path.join(this.root, 'buses', busId, 'photos');
    const directories = [
      this.root,
      path.join(this.root, 'buses'),
      path.join(this.root, 'buses', busId),
      photosDirectory,
    ];
    const filePath = path.join(photosDirectory, fileKey);
    try {
      for (const directory of directories) {
        const stat = await this.io.lstat(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw new Error('La fotografía no está en almacenamiento privado válido.');
      }
      const stat = await this.io.lstat(filePath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== size)
        throw new Error('La fotografía almacenada no coincide con sus metadatos.');
      const bytes = await this.io.readFile(filePath);
      if (bytes.length !== size) throw new Error('La fotografía almacenada está incompleta.');
      return bytes;
    } catch (cause) {
      throw new BusPhotoStorageError({ busId, cause });
    }
  }

  createSession(busId, operationId, references) {
    const io = this.io;
    const staged = path.join(this.root, '.staging', operationId);
    const final = path.join(this.root, 'buses', busId);
    let ownsStage = false;
    let ownsFinal = false;
    let promoted = false;
    let discarded = false;
    const discard = async () => {
      if (ownsStage) {
        await io.rm(staged, { recursive: true, force: true });
        ownsStage = false;
      }
      if (ownsFinal) {
        // El directorio se reservó con mkdir exclusivo; nunca se adopta uno preexistente.
        await io.rm(final, { recursive: true, force: true });
        ownsFinal = false;
      }
      discarded = true;
    };
    return {
      stage: async (photos) => {
        await io.mkdir(staged, { mode: 0o700 });
        ownsStage = true;
        await io.writeFile(
          path.join(staged, 'operation.json'),
          JSON.stringify({ version: 1, busId, operationId, references }),
          { flag: 'wx', mode: 0o600 },
        );
        for (const [index, photo] of photos.entries())
          await io.writeFile(path.join(staged, references[index].fileKey), photo.bytes, {
            flag: 'wx',
            mode: 0o600,
          });
      },
      promote: async () => {
        if (discarded || promoted) throw new Error('La operación de fotos ya terminó.');
        await io.mkdir(final, { mode: 0o700 });
        ownsFinal = true;
        await io.writeFile(
          path.join(final, 'operation.json'),
          JSON.stringify({ busId, operationId }),
          {
            flag: 'wx',
            mode: 0o600,
          },
        );
        await io.rename(staged, path.join(final, 'photos'));
        ownsStage = false;
        promoted = true;
      },
      discard,
    };
  }

  /** Inspección de soporte, solo lectura. No decide si un alta está activa ni borra archivos. */
  async inspectOperation({ busId, operationId }) {
    assertId(busId);
    assertId(operationId);
    const result = [];
    for (const directory of [
      this.root,
      path.join(this.root, '.staging'),
      path.join(this.root, 'buses'),
    ]) {
      try {
        const stat = await this.io.lstat(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw new Error('No se puede inspeccionar una ruta ajena.');
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
    }
    for (const [state, directory] of [
      ['staged', path.join(this.root, '.staging', operationId)],
      ['promoted', path.join(this.root, 'buses', busId)],
    ]) {
      let stat;
      try {
        stat = await this.io.lstat(directory);
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error('No se puede inspeccionar una ruta ajena.');
      const owner = JSON.parse(
        await this.io.readFile(path.join(directory, 'operation.json'), 'utf8'),
      );
      if (owner.busId !== busId || owner.operationId !== operationId)
        throw new Error('La operación no coincide con el directorio.');
      const content = state === 'promoted' ? path.join(directory, 'photos') : directory;
      try {
        const contentStat = await this.io.lstat(content);
        if (!contentStat.isDirectory() || contentStat.isSymbolicLink())
          throw new Error('No se puede inspeccionar una ruta ajena.');
        const manifest = JSON.parse(
          await this.io.readFile(path.join(content, 'operation.json'), 'utf8'),
        );
        const references = createBusPhotoReferences(
          manifest.references.map(({ order, ...photo }) => photo),
        );
        if (manifest.busId !== busId || manifest.operationId !== operationId)
          throw new Error('El manifiesto no coincide.');
        const files = [];
        for (const reference of references) {
          try {
            const file = await this.io.lstat(path.join(content, reference.fileKey));
            files.push({
              fileKey: reference.fileKey,
              complete: file.isFile() && !file.isSymbolicLink() && file.size === reference.size,
            });
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            files.push({ fileKey: reference.fileKey, complete: false });
          }
        }
        result.push({ state, files });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        result.push({ state, files: [], incomplete: true });
      }
    }
    return result;
  }
}

module.exports = LocalBusPhotoStorage;
