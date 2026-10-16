const DomainError = require('../errors/domain-error');
const logger = require('../logger');

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_ERROR = 500;
const INVALID_JSON_CODE = 'INVALID_JSON';
const INVALID_JSON_MESSAGE = 'El cuerpo JSON no es válido.';
const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
const INTERNAL_ERROR_MESSAGE = 'Error interno del servidor.';

/** Cuerpo JSON malformado: body-parser lanza un SyntaxError con estos atributos. */
function isInvalidJsonError(error) {
  return (
    error instanceof SyntaxError && error.status === HTTP_STATUS_BAD_REQUEST && 'body' in error
  );
}

function sendError(res, httpStatus, code, message) {
  res.status(httpStatus).json({ error: { code, message } });
}

/**
 * Middleware central de errores (único punto de traducción a HTTP).
 * Formato: { "error": { "code": "...", "message": "..." } }.
 * Nunca expone stack trace ni detalles internos al cliente.
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof DomainError) {
    sendError(res, error.httpStatus, error.code, error.message);
    return;
  }
  if (isInvalidJsonError(error)) {
    sendError(res, HTTP_STATUS_BAD_REQUEST, INVALID_JSON_CODE, INVALID_JSON_MESSAGE);
    return;
  }
  // No registrar mensajes ni detalles SQL que puedan incluir credenciales.
  logger.error({ errorType: error.name }, 'Error no controlado');
  sendError(res, HTTP_STATUS_INTERNAL_ERROR, INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE);
}

module.exports = errorHandler;
