exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE booking_benefit_requests
    DROP CONSTRAINT booking_benefit_requests_status_check,
    DROP CONSTRAINT booking_benefit_requests_revision_check,
    ADD COLUMN reviewed_at timestamptz,
    ADD COLUMN reviewed_by uuid,
    ADD COLUMN review_fingerprint char(64),
    ADD COLUMN review_expected_revision integer,
    ADD COLUMN review_decisions jsonb,
    ADD COLUMN benefit_review_id bigint,
    ADD CONSTRAINT booking_benefit_requests_review_state CHECK(
      (status='PENDING' AND revision=1 AND reviewed_at IS NULL AND reviewed_by IS NULL
        AND review_fingerprint IS NULL AND review_expected_revision IS NULL
        AND review_decisions IS NULL AND benefit_review_id IS NULL)
      OR
      (status='REVIEWED' AND revision=2 AND reviewed_at IS NOT NULL AND isfinite(reviewed_at)
        AND date_trunc('milliseconds',reviewed_at)=reviewed_at
        AND reviewed_at>=created_at AND reviewed_at<expires_at AND reviewed_by IS NOT NULL
        AND review_fingerprint IS NOT NULL AND review_fingerprint ~ '^[0-9a-f]{64}$'
        AND review_expected_revision=1 AND review_expected_revision IS NOT NULL
        AND review_decisions IS NOT NULL AND jsonb_typeof(review_decisions)='array'
        AND jsonb_array_length(review_decisions)>0 AND benefit_review_id IS NOT NULL AND benefit_review_id>0)
    );
    CREATE FUNCTION protect_benefit_request_review() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP='DELETE' THEN
        IF OLD.status='REVIEWED' THEN RAISE EXCEPTION 'La revisión de acreditación es inmutable.'; END IF;
        RETURN OLD;
      END IF;
      IF OLD.status='REVIEWED' THEN RAISE EXCEPTION 'La revisión de acreditación es inmutable.'; END IF;
      IF (NEW.id,NEW.owner_id,NEW.cooperative_id,NEW.trip_id,NEW.request_key,NEW.fingerprint,
        NEW.from_position,NEW.to_position,NEW.purchase,NEW.journey,NEW.created_at,NEW.expires_at)
        IS DISTINCT FROM
        (OLD.id,OLD.owner_id,OLD.cooperative_id,OLD.trip_id,OLD.request_key,OLD.fingerprint,
        OLD.from_position,OLD.to_position,OLD.purchase,OLD.journey,OLD.created_at,OLD.expires_at)
      THEN RAISE EXCEPTION 'El contexto de la solicitud es inmutable.'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER booking_benefit_request_review_guard BEFORE UPDATE OR DELETE ON booking_benefit_requests
      FOR EACH ROW EXECUTE FUNCTION protect_benefit_request_review();`);
};
exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM booking_benefit_requests WHERE status='REVIEWED') THEN
      RAISE EXCEPTION 'Las revisiones requieren un plan de reversión sin pérdida de evidencia.';
    END IF;
  END $$;
  DROP TRIGGER booking_benefit_request_review_guard ON booking_benefit_requests;
  DROP FUNCTION protect_benefit_request_review();
  ALTER TABLE booking_benefit_requests
    DROP CONSTRAINT booking_benefit_requests_review_state,
    DROP COLUMN reviewed_at, DROP COLUMN reviewed_by, DROP COLUMN review_fingerprint,
    DROP COLUMN review_expected_revision, DROP COLUMN review_decisions, DROP COLUMN benefit_review_id,
    ADD CONSTRAINT booking_benefit_requests_status_check CHECK(status='PENDING'),
    ADD CONSTRAINT booking_benefit_requests_revision_check CHECK(revision=1);`);
};
