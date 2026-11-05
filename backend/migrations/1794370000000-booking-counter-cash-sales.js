// BOOK-CAJA-02: venta en boletería pagada en efectivo, sin comprobante de depósito.
// El propietario de boletería es `counter:<cooperative_id>`; no se crean usuarios.
const UUID = "'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'";

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE bookings
      ADD COLUMN sold_by text,
      ADD COLUMN cash_receipt_id text,
      DROP CONSTRAINT bookings_expiration_check,
      ADD CONSTRAINT bookings_expiration_check CHECK(
        (status='PENDING_PAYMENT' AND expired_at IS NULL) OR
        (status='EXPIRED' AND expired_at IS NOT NULL AND isfinite(expired_at)
          AND date_trunc('milliseconds',expired_at)=expired_at AND expired_at>=expires_at
          AND proof_reception_state='NOT_RECEIVED') OR
        (status IN ('SOLD','REJECTED') AND expired_at IS NULL AND proof_reception_state='RECEIVED') OR
        (status='SOLD' AND expired_at IS NULL AND owner_id LIKE 'counter:%'
          AND proof_reception_state='NOT_RECEIVED')
      ),
      ADD CONSTRAINT bookings_counter_sale_check CHECK(
        (owner_id NOT LIKE 'counter:%' AND sold_by IS NULL AND cash_receipt_id IS NULL) OR
        (owner_id = 'counter:' || cooperative_id AND accepted_proof_id IS NULL AND (
          (status='SOLD' AND sold_by IS NOT NULL AND length(btrim(sold_by)) > 0
            AND cash_receipt_id IS NOT NULL AND cash_receipt_id ~ ${UUID}) OR
          (status<>'SOLD' AND sold_by IS NULL AND cash_receipt_id IS NULL)
        ))
      );
    CREATE UNIQUE INDEX bookings_cash_receipt_unique ON bookings (cash_receipt_id)
      WHERE cash_receipt_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM bookings WHERE owner_id LIKE 'counter:%') THEN
        RAISE EXCEPTION 'Las ventas de boletería requieren un plan de reversión sin pérdida de datos.';
      END IF;
    END $$;
    DROP INDEX bookings_cash_receipt_unique;
    ALTER TABLE bookings
      DROP CONSTRAINT bookings_counter_sale_check,
      DROP CONSTRAINT bookings_expiration_check,
      DROP COLUMN cash_receipt_id,
      DROP COLUMN sold_by,
      ADD CONSTRAINT bookings_expiration_check CHECK(
        (status='PENDING_PAYMENT' AND expired_at IS NULL) OR
        (status='EXPIRED' AND expired_at IS NOT NULL AND isfinite(expired_at)
          AND date_trunc('milliseconds',expired_at)=expired_at AND expired_at>=expires_at
          AND proof_reception_state='NOT_RECEIVED') OR
        (status IN ('SOLD','REJECTED') AND expired_at IS NULL AND proof_reception_state='RECEIVED')
      );
  `);
};
