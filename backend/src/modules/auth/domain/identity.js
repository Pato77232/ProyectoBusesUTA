const AuthError = require('./auth-error');
const ROLES = ['SYSTEM_ADMIN', 'COOPERATIVE_ADMIN', 'CLERK', 'CUSTOMER'];
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role, cooperative_id: user.cooperative_id };
}
function assertIdentity(user) {
  const internal = ['COOPERATIVE_ADMIN', 'CLERK'].includes(user.role);
  if (!ROLES.includes(user.role) || internal !== Boolean(user.cooperative_id)) {
    throw new AuthError('UNAUTHENTICATED');
  }
}
module.exports = { normalizeEmail, publicUser, assertIdentity, ROLES };
