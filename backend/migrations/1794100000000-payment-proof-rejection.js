exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE payment_proofs DROP CONSTRAINT payment_proofs_status_check,
      DROP CONSTRAINT payment_proofs_status_fields_check,
      ADD COLUMN rejected_at timestamptz,
      ADD COLUMN rejected_by text,
      ADD COLUMN rejection_justification text,
      ADD CONSTRAINT payment_proofs_status_check CHECK(status IN ('AWAITING_UPLOAD','UPLOADED','EXPIRED','REJECTED')),
      ADD CONSTRAINT payment_proofs_status_fields_check CHECK(
        (status <> 'UPLOADED' OR (file_key IS NOT NULL AND uploaded_at IS NOT NULL))
        AND (status <> 'AWAITING_UPLOAD' OR (file_key IS NULL AND original_file_name IS NULL AND media_type IS NULL AND file_size_bytes IS NULL AND uploaded_at IS NULL))
        AND (status <> 'EXPIRED' OR expired_at IS NOT NULL)
        AND (status <> 'REJECTED' OR (rejected_at IS NOT NULL AND rejected_by IS NOT NULL AND length(btrim(rejected_by)) > 0 AND rejection_justification IS NOT NULL AND length(btrim(rejection_justification)) > 0))
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM payment_proofs WHERE status='REJECTED') THEN
        RAISE EXCEPTION 'El rechazo persistido requiere un plan de reversión sin pérdida de datos.';
      END IF;
    END $$;
    ALTER TABLE payment_proofs DROP CONSTRAINT payment_proofs_status_fields_check,
      DROP CONSTRAINT payment_proofs_status_check,
      DROP COLUMN rejection_justification,
      DROP COLUMN rejected_by,
      DROP COLUMN rejected_at,
      ADD CONSTRAINT payment_proofs_status_check CHECK(status IN ('AWAITING_UPLOAD','UPLOADED','EXPIRED')),
      ADD CONSTRAINT payment_proofs_status_fields_check CHECK(
        (status <> 'UPLOADED' OR (file_key IS NOT NULL AND uploaded_at IS NOT NULL))
        AND (status <> 'AWAITING_UPLOAD' OR (file_key IS NULL AND original_file_name IS NULL AND media_type IS NULL AND file_size_bytes IS NULL AND uploaded_at IS NULL))
        AND (status <> 'EXPIRED' OR expired_at IS NOT NULL)
      );
  `);
};
