exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE bookings
    ADD COLUMN sale_proof_version bigint,
    ADD COLUMN sale_requested_by text,
    ADD COLUMN sale_requested_at timestamptz,
    ADD COLUMN confirmed_at timestamptz,
    DROP CONSTRAINT bookings_status_check,
    DROP CONSTRAINT bookings_expiration_check,
    ADD CONSTRAINT bookings_status_check CHECK(status IN ('PENDING_PAYMENT','EXPIRED','CONFIRMED')),
    ADD CONSTRAINT bookings_expiration_check CHECK(
      (status IN ('PENDING_PAYMENT','CONFIRMED') AND expired_at IS NULL) OR
      (status='EXPIRED' AND expired_at IS NOT NULL AND isfinite(expired_at)
        AND date_trunc('milliseconds',expired_at)=expired_at AND expired_at>=expires_at
        AND proof_reception_state='NOT_RECEIVED')),
    ADD CONSTRAINT bookings_sale_check CHECK(
      (status<>'CONFIRMED' AND sale_proof_version IS NULL AND sale_requested_by IS NULL
        AND sale_requested_at IS NULL AND confirmed_at IS NULL) OR
      (status='CONFIRMED' AND proof_reception_state='RECEIVED'
        AND sale_proof_version IS NOT NULL AND sale_proof_version BETWEEN 1 AND 9007199254740991
        AND sale_requested_by IS NOT NULL AND length(btrim(sale_requested_by))>0
        AND sale_requested_at IS NOT NULL AND confirmed_at IS NOT NULL
        AND isfinite(sale_requested_at) AND isfinite(confirmed_at)
        AND date_trunc('milliseconds',sale_requested_at)=sale_requested_at
        AND date_trunc('milliseconds',confirmed_at)=confirmed_at
        AND confirmed_at>=sale_requested_at AND confirmed_at>=proof_received_at));
    CREATE FUNCTION protect_booking_sale() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.status='CONFIRMED' AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'La venta confirmada es inmutable.' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END; $$;
    CREATE TRIGGER bookings_sale_immutable BEFORE UPDATE ON bookings
      FOR EACH ROW EXECUTE FUNCTION protect_booking_sale();`);
};

exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM bookings WHERE status='CONFIRMED') THEN
        RAISE EXCEPTION 'Las ventas confirmadas requieren un plan de reversión sin pérdida de datos.';
      END IF;
    END $$;
    DROP TRIGGER bookings_sale_immutable ON bookings;
    DROP FUNCTION protect_booking_sale();
    ALTER TABLE bookings DROP CONSTRAINT bookings_sale_check,
      DROP CONSTRAINT bookings_status_check, DROP CONSTRAINT bookings_expiration_check,
      DROP COLUMN sale_proof_version, DROP COLUMN sale_requested_by,
      DROP COLUMN sale_requested_at, DROP COLUMN confirmed_at,
      ADD CONSTRAINT bookings_status_check CHECK(status IN ('PENDING_PAYMENT','EXPIRED')),
      ADD CONSTRAINT bookings_expiration_check CHECK(
        (status='PENDING_PAYMENT' AND expired_at IS NULL) OR
        (status='EXPIRED' AND expired_at IS NOT NULL AND isfinite(expired_at)
          AND date_trunc('milliseconds',expired_at)=expired_at AND expired_at>=expires_at
          AND proof_reception_state='NOT_RECEIVED'));`);
};
