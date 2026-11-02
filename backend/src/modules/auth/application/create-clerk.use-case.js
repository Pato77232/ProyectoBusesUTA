const { normalizeEmail, publicUser } = require('../domain/identity');

function createClerk({ repository, hasher }) {
  return async ({ cooperativeId, email, password }) => {
    const passwordHash = await hasher.hash(password);
    const user = await repository.createClerk({
      cooperativeId,
      email: normalizeEmail(email),
      passwordHash,
    });
    return publicUser(user);
  };
}

module.exports = createClerk;
