exports.up = (pgm) => {
  pgm.createIndex('auth_password_reset_attempts', ['requested_at', 'id']);
};

exports.down = (pgm) => {
  pgm.dropIndex('auth_password_reset_attempts', ['requested_at', 'id']);
};
