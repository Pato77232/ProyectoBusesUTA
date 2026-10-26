exports.up = (pgm) => {
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
    'payment_proof_notification_outbox_proof_fk',
    {
      foreignKeys: {
        columns: 'payment_proof_id',
        references: 'payment_proofs(id)',
        onDelete: 'CASCADE',
      },
    },
  );
  pgm.addConstraint(
    'payment_proof_notification_outbox',
    'payment_proof_notification_outbox_delivered_at_check',
    {
      check: "(status <> 'DELIVERED' OR delivered_at IS NOT NULL)",
    },
  );
  pgm.createIndex('payment_proof_notification_outbox', ['status', 'created_at'], {
    name: 'payment_proof_notification_outbox_pending_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('payment_proof_notification_outbox');
};
