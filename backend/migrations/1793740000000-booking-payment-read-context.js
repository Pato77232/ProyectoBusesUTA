exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE bookings
      ADD COLUMN proof_window_started_at timestamptz,
      ADD COLUMN proof_window_seconds integer,
      ADD COLUMN proof_reception_state text NOT NULL DEFAULT 'UNKNOWN',
      ADD COLUMN accepted_proof_id text,
      ADD COLUMN proof_received_at timestamptz,
      DROP CONSTRAINT bookings_window_check,
      ADD CONSTRAINT bookings_proof_context_check CHECK (
        (proof_reception_state = 'UNKNOWN'
          AND proof_window_started_at IS NULL AND proof_window_seconds IS NULL
          AND accepted_proof_id IS NULL AND proof_received_at IS NULL
          AND expires_at >= created_at + interval '180 seconds'
          AND expires_at <= created_at + interval '300 seconds')
        OR
        (proof_reception_state IN ('NOT_RECEIVED', 'RECEIVED')
          AND proof_window_started_at IS NOT NULL AND proof_window_seconds IS NOT NULL
          AND proof_window_seconds BETWEEN 180 AND 300
          AND isfinite(proof_window_started_at) AND isfinite(expires_at)
          AND date_trunc('milliseconds', proof_window_started_at) = proof_window_started_at
          AND date_trunc('milliseconds', expires_at) = expires_at
          AND expires_at = proof_window_started_at + proof_window_seconds * interval '1 second'
          AND (
            (proof_reception_state = 'NOT_RECEIVED'
              AND accepted_proof_id IS NULL AND proof_received_at IS NULL)
            OR
            (proof_reception_state = 'RECEIVED'
              AND accepted_proof_id IS NOT NULL AND length(btrim(accepted_proof_id)) > 0
              AND proof_received_at IS NOT NULL AND isfinite(proof_received_at)
              AND date_trunc('milliseconds', proof_received_at) = proof_received_at
              AND proof_received_at >= proof_window_started_at AND proof_received_at < expires_at)
          ))
      );

    CREATE FUNCTION protect_booking_proof_context() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.proof_reception_state <> 'UNKNOWN' AND (
        NEW.proof_window_started_at IS DISTINCT FROM OLD.proof_window_started_at
        OR NEW.proof_window_seconds IS DISTINCT FROM OLD.proof_window_seconds
        OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
        OR NEW.proof_reception_state = 'UNKNOWN'
      ) THEN
        RAISE EXCEPTION 'El plazo original de la reserva es inmutable.' USING ERRCODE = '23514';
      END IF;
      IF OLD.proof_reception_state = 'RECEIVED' AND (
        NEW.proof_reception_state IS DISTINCT FROM OLD.proof_reception_state
        OR NEW.accepted_proof_id IS DISTINCT FROM OLD.accepted_proof_id
        OR NEW.proof_received_at IS DISTINCT FROM OLD.proof_received_at
      ) THEN
        RAISE EXCEPTION 'La primera recepción aceptada es inmutable.' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER bookings_proof_context_immutable BEFORE UPDATE ON bookings
      FOR EACH ROW EXECUTE FUNCTION protect_booking_proof_context();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM bookings
        WHERE NOT (expires_at >= created_at + interval '180 seconds'
          AND expires_at <= created_at + interval '300 seconds')) THEN
        RAISE EXCEPTION 'No se puede restaurar el plazo histórico sin convertir datos.';
      END IF;
    END $$;
    DROP TRIGGER bookings_proof_context_immutable ON bookings;
    DROP FUNCTION protect_booking_proof_context();
    ALTER TABLE bookings DROP CONSTRAINT bookings_proof_context_check,
      DROP COLUMN proof_window_started_at, DROP COLUMN proof_window_seconds,
      DROP COLUMN proof_reception_state, DROP COLUMN accepted_proof_id,
      DROP COLUMN proof_received_at,
      ADD CONSTRAINT bookings_window_check CHECK (
        expires_at >= created_at + interval '180 seconds' AND
        expires_at <= created_at + interval '300 seconds'
      );
  `);
};
