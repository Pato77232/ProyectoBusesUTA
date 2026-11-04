const NotFoundError = require('../errors/not-found-error');

/** Todas las rutas no reconocidas se convierten en un error de dominio 404. */
function notFoundHandler(req, res, next) {
  next(new NotFoundError());
}

module.exports = notFoundHandler;
