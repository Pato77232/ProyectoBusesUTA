exports.up = (pgm) => {
  pgm.createIndex('auth_email_actions', ['requested_at', 'id']);
};

exports.down = (pgm) => {
  pgm.dropIndex('auth_email_actions', ['requested_at', 'id']);
};
