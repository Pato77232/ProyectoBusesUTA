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
  pgm.sql(
    "COMMENT ON COLUMN payment_proofs.cooperative_id IS 'Relación lógica validada desde el contexto de reserva autorizado.'",
  );

  pgm.createTable('payment_proof_notification_outbox', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    payment_proof_id: { type: 'uuid', notNull: true, unique: true },
    booking_id: { type: 'uuid', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      default: 'PENDING',
      check: "status IN ('PENDING', 'DELIVERED')",
    },
    attempt_count: { type: 'integer', notNull: true, default: 0, check: 'attempt_count >= 0' },
    delivered_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.addConstraint(
    'payment_proof_notification_outbox',
    'payment_proof_outbox_delivered_at_check',
    {
      check: "(status <> 'DELIVERED' OR delivered_at IS NOT NULL)",
    },
  );
  pgm.createIndex('payment_proof_notification_outbox', ['status', 'created_at'], {
    name: 'payment_proof_notification_outbox_pending_idx',
  });
  pgm.sql(
    "COMMENT ON COLUMN payment_proof_notification_outbox.payment_proof_id IS 'Vínculo lógico a payment_proofs; ambas filas se administran en la transacción del repositorio.'",
  );
};

exports.down = (pgm) => {
  pgm.dropTable('payment_proof_notification_outbox');
  pgm.dropTable('payment_proofs');
};
