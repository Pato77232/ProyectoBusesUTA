const AuthError = require('../domain/auth-error');
const ERRORS = {
  INVALID_CREDENTIALS: [401, 'Credenciales inválidas.'],
  UNAUTHENTICATED: [401, 'Sesión inválida o vencida.'],
  FORBIDDEN: [403, 'Acceso no permitido.'],
  TOO_MANY_ATTEMPTS: [429, 'Demasiados intentos. Intenta más tarde.'],
  COOPERATIVE_NOT_FOUND: [404, 'Cooperativa no encontrada.'],
  REGISTRATION_CONFLICT: [409, 'No se pudo completar el registro.'],
};
function authErrors(error, req, res, next) {
  if (!(error instanceof AuthError) || !ERRORS[error.code]) return next(error);
  const [status, message] = ERRORS[error.code];
  res.status(status).json({ error: { code: error.code, message } });
}
module.exports = authErrors;
