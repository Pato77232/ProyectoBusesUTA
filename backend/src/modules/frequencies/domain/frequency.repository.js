/**
 * Puerto de persistencia de frecuencias dentro de una cooperativa (RN-02).
 * `cooperative_id` siempre proviene de la sesión y es obligatorio en todos los métodos;
 * ninguna implementación debe permitir leer o escribir datos de otra cooperativa.
 *
 * La consulta pública de frecuencias activas que consumirá la búsqueda (RN-02, RN-23) es de
 * solo lectura y cruza cooperativas.
 */
class FrequencyRepository {
  /** create(cooperativeId, data) guarda la frecuencia con sus paradas y precios; devuelve la frecuencia persistida. */
  async create() {
    throw new Error('FrequencyRepository.create debe implementarse.');
  }

  /** findById(cooperativeId, id) devuelve la frecuencia o lanza FrequencyNotFoundError. */
  async findById() {
    throw new Error('FrequencyRepository.findById debe implementarse.');
  }

  /** list(cooperativeId, filters) devuelve las frecuencias de la cooperativa que cumplen los filtros `status`, `origin` y `destination`. */
  async list() {
    throw new Error('FrequencyRepository.list debe implementarse.');
  }

  /** updateStatus(cooperativeId, id, status) cambia el estado (RN-23) o lanza FrequencyNotFoundError. */
  async updateStatus() {
    throw new Error('FrequencyRepository.updateStatus debe implementarse.');
  }

  /** listAllActiveByRoute(origin, destination) devuelve frecuencias ACTIVAS de todas las cooperativas para la ruta dada (RN-02, RN-23). */
  async listAllActiveByRoute() {
    throw new Error('FrequencyRepository.listAllActiveByRoute debe implementarse.');
  }
}

module.exports = FrequencyRepository;
