const { normalizeEmail } = require('../domain/identity');
function createBootstrapAdmin({ repository, hasher }) {
  return async ({ email, password }) => {
    const passwordHash = await hasher.hash(password);
    return repository.bootstrapAdmin({ email: normalizeEmail(email), passwordHash });
  };
}
module.exports = createBootstrapAdmin;
