const AuthError = require('../domain/auth-error');
const { assertIdentity, publicUser } = require('../domain/identity');
function createAuthenticate({ repository, tokens, clock = () => new Date() }) {
  return async function authenticate(token) {
    const claims = tokens.verify(token);
    const session = await repository.findSession(claims.sid, claims.sub);
    if (
      !session ||
      session.revoked_at ||
      session.expires_at <= clock() ||
      session.role !== claims.role ||
      session.cooperative_id !== claims.cooperative_id
    ) {
      throw new AuthError('UNAUTHENTICATED');
    }
    assertIdentity(session);
    return { user: publicUser(session), sid: claims.sid };
  };
}
module.exports = createAuthenticate;
