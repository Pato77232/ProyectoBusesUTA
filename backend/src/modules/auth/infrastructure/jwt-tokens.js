const jwt = require('jsonwebtoken');
const AuthError = require('../domain/auth-error');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function createTokens({ secret, ttlSeconds }, clock = () => Date.now()) {
  return {
    issue(user, sid) {
      const iat = Math.floor(clock() / 1000);
      const exp = iat + ttlSeconds;
      const token = jwt.sign(
        { sub: user.id, role: user.role, cooperative_id: user.cooperative_id, sid, iat, exp },
        secret,
        { algorithm: 'HS256' },
      );
      return { token, expiresAt: new Date(exp * 1000) };
    },
    verify(token) {
      try {
        const claims = jwt.verify(token, secret, {
          algorithms: ['HS256'],
          // jsonwebtoken interpreta cero como ausencia de reloj.
          clockTimestamp: Math.floor(clock() / 1000) || Number.EPSILON,
        });
        if (
          !UUID.test(claims.sub) ||
          !UUID.test(claims.sid) ||
          !Number.isInteger(claims.exp) ||
          !Number.isInteger(claims.iat)
        )
          throw new Error();
        return claims;
      } catch {
        throw new AuthError('UNAUTHENTICATED');
      }
    },
  };
}
module.exports = createTokens;
