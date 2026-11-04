exports.up = (pgm) => {
  pgm.createTable('booking_guest_access_tokens', {
    id: { type: 'uuid', primaryKey: true },
    booking_id: { type: 'text', notNull: true, references: 'bookings(id)', onDelete: 'CASCADE' },
    token_hash: { type: 'text', notNull: true, unique: true },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.createIndex('booking_guest_access_tokens', ['booking_id', 'expires_at']);
};

exports.down = (pgm) => pgm.dropTable('booking_guest_access_tokens');
