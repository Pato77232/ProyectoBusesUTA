const { normalizeEmail } = require('../domain/identity');
function createRegisterCustomer({ repository, hasher }) {
  return async ({ email, password }) => {
    const passwordHash = await hasher.hash(password);
    await repository.createCustomer({ email: normalizeEmail(email), passwordHash });
  };
}
module.exports = createRegisterCustomer;
