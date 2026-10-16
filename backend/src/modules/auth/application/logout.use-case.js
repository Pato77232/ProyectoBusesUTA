function createLogout({ repository }) {
  return async ({ sid, user }) => repository.revokeSession(sid, user.id);
}
module.exports = createLogout;
