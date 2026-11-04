/** Puerto de almacenamiento privado de comprobantes. */
class FileStorage {
  /** save(file) guarda el archivo y devuelve una clave opaca. */
  async save() {
    throw new Error('FileStorage.save debe implementarse.');
  }

  /** delete(fileKey) elimina el archivo guardado identificado por su clave. */
  async delete() {
    throw new Error('FileStorage.delete debe implementarse.');
  }
}

module.exports = FileStorage;
