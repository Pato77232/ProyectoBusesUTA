const { normalizeEmail, publicUser } = require('../domain/identity');
function createCooperativeAdmin({ repository, hasher }) {
  return async ({ cooperativeId, email, password }) => {
    const passwordHash = await hasher.hash(password);
    const user = await repository.createCooperativeAdmin({
      cooperativeId,
      email: normalizeEmail(email),
      passwordHash,
    });
    return publicUser(user);
  };
}
module.exports = createCooperativeAdmin;
