exports.up = (pgm) => {
  pgm.addConstraint('users', 'users_cooperative_role_check', {
    check:
      "(role IN ('COOPERATIVE_ADMIN', 'CLERK') AND cooperative_id IS NOT NULL) OR (role IN ('SYSTEM_ADMIN', 'CUSTOMER') AND cooperative_id IS NULL)",
  });
  pgm.addConstraint('users', 'users_cooperative_id_fk', {
    foreignKeys: {
      columns: 'cooperative_id',
      references: 'cooperatives(id)',
      onDelete: 'RESTRICT',
    },
  });
};
exports.down = (pgm) => {
  pgm.dropConstraint('users', 'users_cooperative_id_fk');
  pgm.dropConstraint('users', 'users_cooperative_role_check');
};
