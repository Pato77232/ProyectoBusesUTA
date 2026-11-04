exports.up = (pgm) => {
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true, unique: true, check: 'email = lower(btrim(email))' },
    password_hash: { type: 'text', notNull: true },
    role: {
      type: 'text',
      notNull: true,
      check: "role IN ('SYSTEM_ADMIN','COOPERATIVE_ADMIN','CLERK','CUSTOMER')",
    },
    cooperative_id: { type: 'uuid' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.createTable('auth_sessions', {
    id: { type: 'uuid', primaryKey: true },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
    revoke_reason: { type: 'text' },
  });
  pgm.createIndex('auth_sessions', 'user_id');
};
exports.down = (pgm) => {
  pgm.dropTable('auth_sessions');
  pgm.dropTable('users');
};
