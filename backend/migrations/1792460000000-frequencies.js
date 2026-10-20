exports.up = (pgm) => {
  pgm.createTable('frequencies', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    cooperative_id: { type: 'uuid', notNull: true },
    origin: { type: 'text', notNull: true, check: 'length(btrim(origin)) > 0' },
    destination: { type: 'text', notNull: true, check: 'length(btrim(destination)) > 0' },
    departure_time: { type: 'time', notNull: true },
    ant_resolution_number: {
      type: 'text',
      notNull: true,
      check: 'length(btrim(ant_resolution_number)) > 0',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'ACTIVE',
      check: "status IN ('ACTIVE', 'INACTIVE')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint('frequencies', 'frequencies_cooperative_id_fk', {
    foreignKeys: {
      columns: 'cooperative_id',
      references: 'cooperatives(id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint('frequencies', 'frequencies_cooperative_route_unique', {
    unique: ['cooperative_id', 'origin', 'destination', 'departure_time'],
  });

  pgm.createTable('frequency_stops', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    frequency_id: { type: 'uuid', notNull: true },
    position: { type: 'integer', notNull: true },
    place: { type: 'text', notNull: true, check: 'length(btrim(place)) > 0' },
  });
  pgm.addConstraint('frequency_stops', 'frequency_stops_frequency_id_fk', {
    foreignKeys: { columns: 'frequency_id', references: 'frequencies(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('frequency_stops', 'frequency_stops_frequency_position_unique', {
    unique: ['frequency_id', 'position'],
  });

  pgm.createTable('frequency_segment_prices', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    frequency_id: { type: 'uuid', notNull: true },
    from_position: { type: 'integer', notNull: true },
    to_position: { type: 'integer', notNull: true },
    amount: { type: 'numeric', precision: 10, scale: 2, notNull: true, check: 'amount > 0' },
  });
  pgm.addConstraint('frequency_segment_prices', 'frequency_segment_prices_frequency_id_fk', {
    foreignKeys: { columns: 'frequency_id', references: 'frequencies(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('frequency_segment_prices', 'frequency_segment_prices_frequency_from_unique', {
    unique: ['frequency_id', 'from_position'],
  });
  pgm.addConstraint('frequency_segment_prices', 'frequency_segment_prices_consecutive_positions', {
    check: 'to_position = from_position + 1',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('frequency_segment_prices');
  pgm.dropTable('frequency_stops');
  pgm.dropTable('frequencies');
};
