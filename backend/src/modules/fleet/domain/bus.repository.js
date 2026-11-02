/**
 * Puerto transaccional. create recibe id/cooperativeId de servidor, metadatos,
 * configuración derivada de catálogo y referencias de fotos de servidor.
 * beforeCommit promueve archivos ya preparados; si falla, no se confirma la BD.
 * Un COMMIT incierto lanza BUS_REGISTRATION_COMMIT_UNKNOWN: el consumidor debe
 * conservar los archivos hasta reconciliar, no ejecutar limpieza destructiva.
 * Las lecturas siempre filtran por cooperativeId y devuelven resúmenes sin VIN,
 * fotos ni plantilla. Un identificador inválido equivale a un bus inexistente.
 */
class BusRepository {
  async create() {
    throw new Error('BusRepository.create debe implementarse.');
  }

  async findById() {
    throw new Error('BusRepository.findById debe implementarse.');
  }

  async listByCooperative() {
    throw new Error('BusRepository.listByCooperative debe implementarse.');
  }

  async listByBusGroup() {
    throw new Error('BusRepository.listByBusGroup debe implementarse.');
  }

  async listSeats() {
    throw new Error('BusRepository.listSeats debe implementarse.');
  }
}

module.exports = BusRepository;
