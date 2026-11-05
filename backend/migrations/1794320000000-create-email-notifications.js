exports.up = (pgm) => {
  pgm.sql(`CREATE TABLE email_notifications (
    id uuid PRIMARY KEY,
    kind text NOT NULL CHECK (kind IN ('TICKETS_READY','PROOF_REJECTED','BOOKING_EXPIRED')),
    booking_id text NOT NULL CHECK (length(btrim(booking_id)) > 0),
    cooperative_id text NOT NULL CHECK (length(btrim(cooperative_id)) > 0),
    payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
    state text NOT NULL DEFAULT 'PENDING'
      CHECK (state IN ('PENDING','SENDING','ACCEPTED','FAILED','SKIPPED')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at timestamptz NOT NULL,
    claimed_at timestamptz,
    finished_at timestamptz,
    last_error_code text CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Z_]{1,64}$'),
    created_at timestamptz NOT NULL,
    CONSTRAINT email_notifications_kind_booking_unique UNIQUE (kind, booking_id),
    CONSTRAINT email_notifications_claim_check CHECK ((state = 'SENDING') = (claimed_at IS NOT NULL)),
    CONSTRAINT email_notifications_finish_check
      CHECK ((state IN ('ACCEPTED','FAILED','SKIPPED')) = (finished_at IS NOT NULL))
  );
  CREATE INDEX email_notifications_due ON email_notifications (state, next_attempt_at);`);
};
exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM email_notifications) THEN
      RAISE EXCEPTION 'Los avisos registrados requieren un plan de reversión sin pérdida de datos.';
    END IF;
  END $$;
  DROP TABLE email_notifications;`);
};
