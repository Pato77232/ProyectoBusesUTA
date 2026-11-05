exports.up = (pgm) => {
  pgm.createTable('auth_guest_buyers', {
    id: { type: 'uuid', primaryKey: true },
    email: { type: 'text', notNull: true, unique: true, check: 'email = lower(btrim(email))' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.createTable('auth_guest_verifications', {
    email: { type: 'text', notNull: true, check: 'email = lower(btrim(email))' },
    token_hash: { type: 'text', primaryKey: true, check: 'length(token_hash) = 64' },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.createTable('auth_guest_sessions', {
    id: { type: 'uuid', primaryKey: true },
    buyer_id: { type: 'uuid', notNull: true, references: 'auth_guest_buyers(id)' },
    session_hash: { type: 'text', notNull: true, unique: true, check: 'length(session_hash) = 64' },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.createIndex('auth_guest_sessions', ['buyer_id', 'expires_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('auth_guest_sessions');
  pgm.dropTable('auth_guest_verifications');
  pgm.dropTable('auth_guest_buyers');
};
