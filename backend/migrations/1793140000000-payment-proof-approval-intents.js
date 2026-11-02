exports.up = (pgm) => {
  pgm.addColumns('payment_proofs', {
    approval_requested_at: { type: 'timestamptz' },
    approval_requested_by: { type: 'uuid' },
  });
  pgm.sql(`
    UPDATE payment_proofs
    SET approval_requested_at = approved_at,
        approval_requested_by = approved_by
    WHERE approved_at IS NOT NULL AND approved_by IS NOT NULL
  `);
  pgm.addConstraint('payment_proofs', 'payment_proofs_approval_request_fields_check', {
    check: '(approval_requested_at IS NULL) = (approval_requested_by IS NULL)',
  });
  pgm.addConstraint('payment_proofs', 'payment_proofs_approval_requires_request_check', {
    check: 'approved_at IS NULL OR approval_requested_at IS NOT NULL',
  });
  pgm.sql(
    "COMMENT ON COLUMN payment_proofs.approval_requested_by IS 'Actor que inició la intención de aprobación; vínculo lógico, sin FK a users.'",
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint('payment_proofs', 'payment_proofs_approval_requires_request_check');
  pgm.dropConstraint('payment_proofs', 'payment_proofs_approval_request_fields_check');
  pgm.dropColumns('payment_proofs', ['approval_requested_by', 'approval_requested_at']);
};
