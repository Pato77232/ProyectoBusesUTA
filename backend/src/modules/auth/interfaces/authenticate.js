const { readCookie } = require('./cookies');
function authenticationMiddleware(authenticate) {
  return async (req, res, next) => {
    try {
      req.auth = await authenticate(readCookie(req, 'access_token'));
      next();
    } catch (error) {
      next(error);
    }
  };
}
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.auth)
      return res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Sesión inválida o vencida.' } });
    if (!roles.includes(req.auth.user.role))
      return res
        .status(403)
        .json({ error: { code: 'FORBIDDEN', message: 'Acceso no permitido.' } });
    next();
  };
}
module.exports = { authenticationMiddleware, authorize };
