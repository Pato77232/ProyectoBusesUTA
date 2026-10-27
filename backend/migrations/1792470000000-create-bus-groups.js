exports.up = (pgm) => {
  pgm.createTable('bus_groups', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    cooperative_id: { type: 'uuid', notNull: true },
    name: { type: 'text', notNull: true, check: 'length(btrim(name)) > 0' },
    category: {
      type: 'text',
      notNull: true,
      check: "category IN ('LONG_ROUTE', 'CANTONAL', 'URBAN_RURAL')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('bus_groups', 'bus_groups_cooperative_id_fk', {
    foreignKeys: {
      columns: 'cooperative_id',
      references: 'cooperatives(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.sql(
    "CREATE UNIQUE INDEX bus_groups_cooperative_name_unique ON bus_groups (cooperative_id, lower(name));",
  );

  pgm.createIndex('bus_groups', 'cooperative_id', {
    name: 'bus_groups_cooperative_id_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('bus_groups');
};
