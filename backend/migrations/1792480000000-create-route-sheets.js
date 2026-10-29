exports.up = (pgm) => {
  pgm.createType('route_sheet_status', ['DRAFT', 'PUBLISHED']);

  pgm.createTable('route_sheets', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    cooperative_id: { type: 'uuid', notNull: true },
    bus_group_id: { type: 'uuid', notNull: true },
    route_date: { type: 'date', notNull: true },
    status: { type: 'route_sheet_status', notNull: true, default: 'DRAFT' },
    is_base: { type: 'boolean', notNull: true, default: false },
    cycle_length_weeks: { type: 'integer' },
    created_by: { type: 'uuid' },
    published_by: { type: 'uuid' },
    published_at: { type: 'timestamptz' },
    notes: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('route_sheets', 'route_sheets_cooperative_id_fk', {
    foreignKeys: {
      columns: 'cooperative_id',
      references: 'cooperatives(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.addConstraint('route_sheets', 'route_sheets_bus_group_id_fk', {
    foreignKeys: {
      columns: 'bus_group_id',
      references: 'bus_groups(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.sql(
    'CREATE UNIQUE INDEX route_sheets_cooperative_bus_group_date_unique ON route_sheets (cooperative_id, bus_group_id, route_date);',
  );
  pgm.createIndex('route_sheets', ['cooperative_id', 'bus_group_id', 'route_date', 'status'], {
    name: 'route_sheets_lookup_idx',
  });

  pgm.createTable('route_sheet_assignments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    route_sheet_id: { type: 'uuid', notNull: true },
    cooperative_id: { type: 'uuid', notNull: true },
    bus_group_id: { type: 'uuid', notNull: true },
    bus_id: { type: 'uuid', notNull: true },
    frequency_id: { type: 'uuid', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('route_sheet_assignments', 'route_sheet_assignments_route_sheet_id_fk', {
    foreignKeys: {
      columns: 'route_sheet_id',
      references: 'route_sheets(id)',
      onDelete: 'CASCADE',
    },
  });

  pgm.sql('CREATE UNIQUE INDEX route_sheet_assignments_sheet_bus_unique ON route_sheet_assignments (route_sheet_id, bus_id);');
  pgm.sql('CREATE UNIQUE INDEX route_sheet_assignments_sheet_frequency_unique ON route_sheet_assignments (route_sheet_id, frequency_id);');
  pgm.createIndex('route_sheet_assignments', ['cooperative_id', 'route_sheet_id', 'bus_id', 'frequency_id'], {
    name: 'route_sheet_assignments_lookup_idx',
  });

  pgm.createTable('route_sheet_rest_days', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    route_sheet_id: { type: 'uuid', notNull: true },
    cooperative_id: { type: 'uuid', notNull: true },
    bus_group_id: { type: 'uuid', notNull: true },
    bus_id: { type: 'uuid', notNull: true },
    reason: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('route_sheet_rest_days', 'route_sheet_rest_days_route_sheet_id_fk', {
    foreignKeys: {
      columns: 'route_sheet_id',
      references: 'route_sheets(id)',
      onDelete: 'CASCADE',
    },
  });

  pgm.sql('CREATE UNIQUE INDEX route_sheet_rest_days_sheet_bus_unique ON route_sheet_rest_days (route_sheet_id, bus_id);');
  pgm.createIndex('route_sheet_rest_days', ['cooperative_id', 'route_sheet_id', 'bus_id'], {
    name: 'route_sheet_rest_days_lookup_idx',
  });

  pgm.createTable('route_sheet_cycles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    base_route_sheet_id: { type: 'uuid', notNull: true },
    cooperative_id: { type: 'uuid', notNull: true },
    bus_group_id: { type: 'uuid', notNull: true },
    cycle_number: { type: 'integer', notNull: true, check: 'cycle_number IN (1,2)' },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date', notNull: true },
    status: { type: 'route_sheet_status', notNull: true, default: 'DRAFT' },
    generated_by: { type: 'uuid' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('route_sheet_cycles', 'route_sheet_cycles_base_route_sheet_id_fk', {
    foreignKeys: {
      columns: 'base_route_sheet_id',
      references: 'route_sheets(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.sql('CREATE UNIQUE INDEX route_sheet_cycles_base_number_unique ON route_sheet_cycles (base_route_sheet_id, cycle_number);');
  pgm.sql('CREATE UNIQUE INDEX route_sheet_cycles_coop_group_start_unique ON route_sheet_cycles (cooperative_id, bus_group_id, start_date);');
  pgm.createIndex('route_sheet_cycles', ['cooperative_id', 'bus_group_id', 'start_date', 'end_date'], {
    name: 'route_sheet_cycles_lookup_idx',
  });

  pgm.createTable('route_sheet_modification_logs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    route_sheet_id: { type: 'uuid', notNull: true },
    route_sheet_cycle_id: { type: 'uuid' },
    cooperative_id: { type: 'uuid', notNull: true },
    bus_group_id: { type: 'uuid', notNull: true },
    modified_by: { type: 'uuid', notNull: true },
    reason: { type: 'text', notNull: true },
    action: { type: 'varchar(50)', notNull: true },
    affected_entity: { type: 'varchar(20)', notNull: true },
    entity_id: { type: 'uuid', notNull: true },
    old_value: { type: 'jsonb' },
    new_value: { type: 'jsonb' },
    has_passengers_warning: { type: 'boolean', notNull: true, default: false },
    passengers_notified_context: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('route_sheet_modification_logs', 'route_sheet_modification_logs_route_sheet_id_fk', {
    foreignKeys: {
      columns: 'route_sheet_id',
      references: 'route_sheets(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.addConstraint('route_sheet_modification_logs', 'route_sheet_modification_logs_route_sheet_cycle_id_fk', {
    foreignKeys: {
      columns: 'route_sheet_cycle_id',
      references: 'route_sheet_cycles(id)',
      onDelete: 'RESTRICT',
    },
  });

  pgm.createIndex('route_sheet_modification_logs', ['cooperative_id', 'route_sheet_id', 'modified_by', 'created_at'], {
    name: 'route_sheet_modification_logs_lookup_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('route_sheet_modification_logs');
  pgm.dropTable('route_sheet_cycles');
  pgm.dropTable('route_sheet_rest_days');
  pgm.dropTable('route_sheet_assignments');
  pgm.dropTable('route_sheets');
  pgm.dropType('route_sheet_status');
};
