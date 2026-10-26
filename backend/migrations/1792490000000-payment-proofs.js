exports.up = (pgm) => {
  pgm.createTable('payment_proofs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    booking_id: { type: 'uuid', notNull: true },
    cooperative_id: { type: 'uuid', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      default: 'AWAITING_UPLOAD',
      check: "status IN ('AWAITING_UPLOAD', 'UPLOADED', 'EXPIRED')",
    },
    file_key: { type: 'text' },
    original_file_name: { type: 'text' },
    media_type: { type: 'text' },
    file_size_bytes: { type: 'bigint' },
    uploaded_at: { type: 'timestamptz' },
    expired_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('payment_proofs', 'payment_proofs_cooperative_id_fk', {
    foreignKeys: {
      columns: 'cooperative_id',
      references: 'cooperatives(id)',
      onDelete: 'RESTRICT',
    },
  });
  pgm.addConstraint('payment_proofs', 'payment_proofs_booking_id_unique', {
    unique: ['booking_id'],
  });
  pgm.addConstraint('payment_proofs', 'payment_proofs_status_fields_check', {
    check: `
      (status <> 'UPLOADED' OR (file_key IS NOT NULL AND uploaded_at IS NOT NULL))
      AND (status <> 'AWAITING_UPLOAD' OR (
        file_key IS NULL AND original_file_name IS NULL AND media_type IS NULL
        AND file_size_bytes IS NULL AND uploaded_at IS NULL
      ))
      AND (status <> 'EXPIRED' OR expired_at IS NOT NULL)
    `,
  });
  pgm.createIndex('payment_proofs', ['status', 'booking_id'], {
    name: 'payment_proofs_status_booking_id_idx',
  });
  pgm.sql(
    "COMMENT ON COLUMN payment_proofs.booking_id IS 'Sin FK hasta acordar el contrato de bookings con Leslie.'",
  );
};

exports.down = (pgm) => {
  pgm.dropTable('payment_proofs');
};
