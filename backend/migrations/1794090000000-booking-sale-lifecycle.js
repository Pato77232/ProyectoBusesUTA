exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE bookings DROP CONSTRAINT bookings_status_check,
      DROP CONSTRAINT bookings_expiration_check,
      ADD COLUMN sold_at timestamptz,
      ADD COLUMN rejected_at timestamptz,
      ADD COLUMN rejection_justification text,
      ADD COLUMN rejected_by text,
      ADD CONSTRAINT bookings_status_check CHECK(status IN ('PENDING_PAYMENT','EXPIRED','SOLD','REJECTED')),
      ADD CONSTRAINT bookings_sale_state_check CHECK(
        (status IN ('PENDING_PAYMENT','EXPIRED') AND sold_at IS NULL AND rejected_at IS NULL AND rejection_justification IS NULL AND rejected_by IS NULL)
        OR (status='SOLD' AND sold_at IS NOT NULL AND rejected_at IS NULL AND rejection_justification IS NULL AND rejected_by IS NULL)
        OR (status='REJECTED' AND sold_at IS NULL AND rejected_at IS NOT NULL AND length(btrim(rejection_justification)) > 0 AND rejected_by IS NOT NULL AND length(btrim(rejected_by)) > 0)
      ),
      ADD CONSTRAINT bookings_expiration_check CHECK(
        (status='PENDING_PAYMENT' AND expired_at IS NULL) OR
        (status='EXPIRED' AND expired_at IS NOT NULL AND isfinite(expired_at)
          AND date_trunc('milliseconds',expired_at)=expired_at AND expired_at>=expires_at
          AND proof_reception_state='NOT_RECEIVED') OR
        (status IN ('SOLD','REJECTED') AND expired_at IS NULL AND proof_reception_state='RECEIVED')
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM bookings WHERE status IN ('SOLD','REJECTED')) THEN
        RAISE EXCEPTION 'La venta o rechazo persistido requiere un plan de reversión sin pérdida de datos.';
      END IF;
    END $$;
    ALTER TABLE bookings DROP CONSTRAINT bookings_expiration_check,
      DROP CONSTRAINT bookings_sale_state_check,
      DROP COLUMN rejected_by,
      DROP COLUMN rejection_justification,
      DROP COLUMN rejected_at,
      DROP COLUMN sold_at,
      DROP CONSTRAINT bookings_status_check,
      ADD CONSTRAINT bookings_expiration_check CHECK(
        (status='PENDING_PAYMENT' AND expired_at IS NULL) OR
        (status='EXPIRED' AND expired_at IS NOT NULL AND isfinite(expired_at)
          AND date_trunc('milliseconds',expired_at)=expired_at AND expired_at>=expires_at
          AND proof_reception_state='NOT_RECEIVED')),
      ADD CONSTRAINT bookings_status_check CHECK(status IN ('PENDING_PAYMENT','EXPIRED'));
  `);
};
