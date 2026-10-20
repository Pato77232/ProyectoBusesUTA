exports.up = (pgm) => {
  pgm.createIndex('users', 'cooperative_id', {
    name: 'users_cooperative_admin_unique',
    unique: true,
    where: "role = 'COOPERATIVE_ADMIN'",
  });
};
exports.down = (pgm) =>
  pgm.dropIndex('users', 'cooperative_id', { name: 'users_cooperative_admin_unique' });
