const AuthError = require('../domain/auth-error');
const { normalizeEmail, assertIdentity } = require('../domain/identity');
function createLogin({ repository, hasher, tokens, limiter, newId }) {
  return async function login({ email, password, ip }) {
    const normalized = normalizeEmail(email);
    const finish = limiter.begin(normalized, ip);
    let outcome = 'error';
    try {
      const user = await repository.findByEmail(normalized);
      const valid = await hasher.verify(user ? user.password_hash : hasher.dummyHash, password);
      if (!user || !valid) {
        outcome = 'failure';
        throw new AuthError('INVALID_CREDENTIALS');
      }
      assertIdentity(user);
      const sid = newId();
      const issued = tokens.issue(user, sid);
      await repository.createSession({ id: sid, userId: user.id, expiresAt: issued.expiresAt });
      outcome = 'success';
      return issued;
    } finally {
      finish(outcome);
    }
  };
}
module.exports = createLogin;
