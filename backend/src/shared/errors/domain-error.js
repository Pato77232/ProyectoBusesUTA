/**
 * Error base de dominio. Los módulos lo extienden con códigos propios
 * (ej. FrequencyRequiresAntResolutionError) y el middleware central de
 * errores lo traduce a la respuesta HTTP única.
 */
class DomainError extends Error {
  constructor(message, code, httpStatus) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

module.exports = DomainError;
