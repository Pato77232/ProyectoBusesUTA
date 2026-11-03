exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE bookings DROP CONSTRAINT bookings_status_check,
    ADD COLUMN expired_at timestamptz,
    ADD CONSTRAINT bookings_status_check CHECK(status IN ('PENDING_PAYMENT','EXPIRED')),
    ADD CONSTRAINT bookings_expiration_check CHECK(
      (status='PENDING_PAYMENT' AND expired_at IS NULL) OR
      (status='EXPIRED' AND expired_at IS NOT NULL AND isfinite(expired_at)
        AND date_trunc('milliseconds',expired_at)=expired_at AND expired_at>=expires_at
        AND proof_reception_state='NOT_RECEIVED'));
    CREATE UNIQUE INDEX bookings_accepted_proof_unique ON bookings(accepted_proof_id) WHERE proof_reception_state='RECEIVED';
    CREATE TABLE booking_proof_receipt_results(
      payment_proof_id text PRIMARY KEY CHECK(length(btrim(payment_proof_id))>0),
      booking_id text NOT NULL,
      cooperative_id text NOT NULL,
      trip_id text NOT NULL,
      outcome text NOT NULL CHECK(outcome IN ('ACCEPTED','REJECTED_EXPIRED')),
      decided_at timestamptz NOT NULL CHECK(isfinite(decided_at) AND date_trunc('milliseconds',decided_at)=decided_at),
      FOREIGN KEY(booking_id,cooperative_id,trip_id) REFERENCES bookings(id,cooperative_id,trip_id)
    );
    CREATE UNIQUE INDEX booking_receipts_accepted_booking_unique ON booking_proof_receipt_results(booking_id) WHERE outcome='ACCEPTED';
    CREATE FUNCTION protect_booking_receipt_result() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'El resultado de recepción es inmutable.' USING ERRCODE='23514'; END; $$;
    CREATE TRIGGER booking_receipt_result_immutable BEFORE UPDATE ON booking_proof_receipt_results FOR EACH ROW EXECUTE FUNCTION protect_booking_receipt_result();`);
};
exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM booking_proof_receipt_results) OR EXISTS(SELECT 1 FROM bookings WHERE status='EXPIRED') THEN
      RAISE EXCEPTION 'La recepción o expiración persistida requiere un plan de reversión sin pérdida de datos.';
    END IF;
    END $$;
    DROP TABLE booking_proof_receipt_results;
    DROP FUNCTION protect_booking_receipt_result();
    DROP INDEX bookings_accepted_proof_unique;
    ALTER TABLE bookings DROP CONSTRAINT bookings_expiration_check,
      DROP CONSTRAINT bookings_status_check, DROP COLUMN expired_at,
      ADD CONSTRAINT bookings_status_check CHECK(status='PENDING_PAYMENT');`);
};
