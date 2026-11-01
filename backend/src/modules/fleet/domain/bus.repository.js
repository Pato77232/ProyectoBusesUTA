/**
 * Puerto transaccional. create recibe id/cooperativeId de servidor, metadatos,
 * configuración derivada de catálogo y referencias de fotos de servidor.
 * beforeCommit promueve archivos ya preparados; si falla, no se confirma la BD.
 * Un COMMIT incierto lanza BUS_REGISTRATION_COMMIT_UNKNOWN: el consumidor debe
 * conservar los archivos hasta reconciliar, no ejecutar limpieza destructiva.
 */
class BusRepository {
  async create() {
    throw new Error('BusRepository.create debe implementarse.');
  }
}

module.exports = BusRepository;
