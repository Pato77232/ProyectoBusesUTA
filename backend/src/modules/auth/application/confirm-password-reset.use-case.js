const { createHash } = require('node:crypto');
const AuthError = require('../domain/auth-error');

function createConfirmPasswordReset({ repository, hasher }) {
  return async ({ token, password }) => {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (!(await repository.findUsableToken(tokenHash))) throw new AuthError('INVALID_RESET_TOKEN');
    const passwordHash = await hasher.hash(password);
    const consumed = await repository.consumeToken({ tokenHash, passwordHash });
    if (!consumed) throw new AuthError('INVALID_RESET_TOKEN');
  };
}

module.exports = createConfirmPasswordReset;
