exports.up = (pgm) => {
  pgm.addColumns('payment_proofs', {
    upload_authorized_by: { type: 'text' },
    upload_authorized_at: { type: 'timestamptz' },
  });
  pgm.addConstraint('payment_proofs', 'payment_proof_upload_provenance_pair_check', {
    check: `
      (upload_authorized_by IS NULL AND upload_authorized_at IS NULL)
      OR (upload_authorized_by IS NOT NULL AND length(btrim(upload_authorized_by)) > 0
          AND upload_authorized_at IS NOT NULL)
    `,
  });
};

exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM payment_proofs WHERE upload_authorized_at IS NOT NULL) THEN
      RAISE EXCEPTION 'No se puede quitar la procedencia de cargas autorizadas.' USING ERRCODE='23514';
    END IF;
  END $$;`);
  pgm.dropConstraint('payment_proofs', 'payment_proof_upload_provenance_pair_check');
  pgm.dropColumns('payment_proofs', ['upload_authorized_by', 'upload_authorized_at']);
};
