exports.up = (pgm) => {
  pgm.sql(`CREATE TABLE booking_benefit_reviews (
    id bigserial PRIMARY KEY,
    cooperative_id uuid NOT NULL,
    reviewed_by uuid NOT NULL,
    context_hash char(64) NOT NULL,
    decisions jsonb NOT NULL CHECK (jsonb_typeof(decisions) = 'array'),
    reviewed_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL CHECK (expires_at > reviewed_at)
  );
  CREATE INDEX booking_benefit_reviews_context ON booking_benefit_reviews
    (cooperative_id, context_hash, id DESC);`);
};
exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM booking_benefit_reviews) THEN
      RAISE EXCEPTION 'Las acreditaciones requieren un plan de reversión sin pérdida de datos.';
    END IF;
  END $$;
  DROP TABLE booking_benefit_reviews;`);
};
