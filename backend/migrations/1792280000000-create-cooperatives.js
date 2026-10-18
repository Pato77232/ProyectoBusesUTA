exports.up = (pgm) => {
  pgm.createTable('cooperatives', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true, check: 'length(btrim(name)) > 0' },
    ruc: { type: 'text', notNull: true, check: "ruc ~ '^[0-9]{13}$'" },
    email: { type: 'text' },
    phone: { type: 'text' },
    address: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('cooperatives', 'cooperatives_ruc_unique', { unique: ['ruc'] });
};
exports.down = (pgm) => {
  pgm.dropTable('cooperatives');
};
