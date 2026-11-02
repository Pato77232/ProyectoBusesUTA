/** Recibe bytes ya validados por el transporte; no sustituye la decodificación de T4.
 * prepare devuelve una sesión privada con references, operationId, promote y discard.
 * discard solo elimina archivos de esa operación; nunca se usa tras COMMIT incierto.
 */
class BusPhotoStorage {
  async prepare() {
    throw new Error('BusPhotoStorage.prepare debe implementarse.');
  }
}

module.exports = BusPhotoStorage;
