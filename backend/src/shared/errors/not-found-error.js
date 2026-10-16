const DomainError = require('./domain-error');

const HTTP_STATUS_NOT_FOUND = 404;
const NOT_FOUND_CODE = 'NOT_FOUND';

/** Recurso inexistente o ruta desconocida. */
class NotFoundError extends DomainError {
  constructor(message = 'Recurso no encontrado.') {
    super(message, NOT_FOUND_CODE, HTTP_STATUS_NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

module.exports = NotFoundError;
