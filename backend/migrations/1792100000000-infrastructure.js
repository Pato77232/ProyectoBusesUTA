exports.up = (pgm) => {
  pgm.createTable('infrastructure_checks', {
    id: { type: 'integer', primaryKey: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
};
exports.down = (pgm) => {
  pgm.dropTable('infrastructure_checks');
};
