exports.up = (pgm) => {
  pgm.createTable('auth_email_actions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    // Las acciones son efímeras; el emisor debe comprobar que el usuario aún existe.
    user_id: { type: 'uuid', notNull: true },
    purpose: { type: 'text', notNull: true, check: "purpose = 'PASSWORD_RESET'" },
    state: {
      type: 'text',
      notNull: true,
      check: "state IN ('PENDING','SENDING','ACCEPTED','FAILED','SUPERSEDED','USED')",
    },
    token_hash: { type: 'text' },
    token_expires_at: { type: 'timestamptz' },
    requested_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    available_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    claimed_at: { type: 'timestamptz' },
    attempts: { type: 'integer', notNull: true, default: 0, check: 'attempts >= 0' },
    used_at: { type: 'timestamptz' },
  });
  pgm.createIndex('auth_email_actions', ['state', 'available_at']);
  pgm.createIndex('auth_email_actions', ['user_id', 'purpose']);
  pgm.createIndex('auth_email_actions', ['user_id', 'purpose'], {
    unique: true,
    where: "state IN ('PENDING','SENDING','ACCEPTED') AND used_at IS NULL",
    name: 'auth_email_actions_one_active',
  });
  pgm.createTable('auth_password_reset_attempts', {
    id: { type: 'bigserial', primaryKey: true },
    email: { type: 'text', notNull: true },
    ip: { type: 'text', notNull: true },
    accepted: { type: 'boolean', notNull: true },
    requested_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.createIndex('auth_password_reset_attempts', ['email', 'requested_at']);
  pgm.createIndex('auth_password_reset_attempts', ['ip', 'requested_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('auth_password_reset_attempts');
  pgm.dropTable('auth_email_actions');
};
