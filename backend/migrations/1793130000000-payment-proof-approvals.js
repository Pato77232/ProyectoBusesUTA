exports.up = (pgm) => {
  pgm.addColumns('payment_proofs', {
    approved_at: { type: 'timestamptz' },
    approved_by: { type: 'uuid' },
  });
  pgm.addConstraint('payment_proofs', 'payment_proofs_approval_fields_check', {
    check: '(approved_at IS NULL) = (approved_by IS NULL)',
  });
  pgm.createIndex('payment_proofs', ['cooperative_id', 'uploaded_at', 'id'], {
    name: 'payment_proofs_clerk_inbox_idx',
    where: "status = 'UPLOADED' AND approved_at IS NULL",
  });
  pgm.sql(
    "COMMENT ON COLUMN payment_proofs.approved_by IS 'Relación lógica con la identidad CLERK; sin FK entre módulos.'",
  );
};

exports.down = (pgm) => {
  pgm.dropIndex('payment_proofs', ['cooperative_id', 'uploaded_at', 'id'], {
    name: 'payment_proofs_clerk_inbox_idx',
  });
  pgm.dropConstraint('payment_proofs', 'payment_proofs_approval_fields_check');
  pgm.dropColumns('payment_proofs', ['approved_by', 'approved_at']);
};
