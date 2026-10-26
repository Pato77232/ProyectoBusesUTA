const { randomUUID } = require('node:crypto');
const { mkdir, unlink, writeFile } = require('node:fs/promises');
const path = require('node:path');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class LocalPrivateFileStorage {
  constructor({ rootDirectory }) {
    if (typeof rootDirectory !== 'string' || !rootDirectory.trim()) {
      throw new TypeError('Se requiere un directorio privado para comprobantes.');
    }
    this.rootDirectory = path.resolve(rootDirectory);
  }

  async save(file) {
    if (!file || !Buffer.isBuffer(file.buffer)) {
      throw new TypeError('El contenido del comprobante debe ser un Buffer.');
    }

    await mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    const fileKey = randomUUID();
    const filePath = path.join(this.rootDirectory, fileKey);

    try {
      await writeFile(filePath, file.buffer, { flag: 'wx', mode: 0o600 });
    } catch (error) {
      await unlink(filePath).catch(() => {});
      throw error;
    }

    return fileKey;
  }

  async delete(fileKey) {
    if (typeof fileKey !== 'string' || !UUID_PATTERN.test(fileKey)) {
      throw new TypeError('La clave del archivo no es válida.');
    }

    try {
      await unlink(path.join(this.rootDirectory, fileKey));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

module.exports = LocalPrivateFileStorage;
