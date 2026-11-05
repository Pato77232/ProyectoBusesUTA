exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE booking_benefit_requests (
      id uuid PRIMARY KEY, owner_id uuid NOT NULL, cooperative_id uuid NOT NULL, trip_id uuid NOT NULL,
      request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{16,128}$'),
      fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
      from_position bigint NOT NULL CHECK(from_position >= 0),
      to_position bigint NOT NULL CHECK(to_position > from_position AND to_position <= 9007199254740991),
      purchase jsonb NOT NULL CHECK(jsonb_typeof(purchase)='object' AND jsonb_typeof(purchase->'passengers')='array' AND jsonb_array_length(purchase->'passengers')>0),
      journey jsonb NOT NULL CHECK(jsonb_typeof(journey)='object'),
      status text NOT NULL DEFAULT 'PENDING' CHECK(status='PENDING'),
      revision integer NOT NULL DEFAULT 1 CHECK(revision=1),
      created_at timestamptz NOT NULL CHECK(isfinite(created_at) AND date_trunc('milliseconds',created_at)=created_at),
      expires_at timestamptz NOT NULL CHECK(isfinite(expires_at) AND expires_at>created_at AND date_trunc('milliseconds',expires_at)=expires_at),
      UNIQUE(owner_id,request_key)
    );
    CREATE INDEX booking_benefit_requests_queue_idx ON booking_benefit_requests(cooperative_id,created_at DESC,id DESC);
  `);
};
exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM booking_benefit_requests) THEN
      RAISE EXCEPTION 'Las solicitudes de acreditación requieren un plan de reversión sin pérdida de datos.';
    END IF;
  END $$;
  DROP TABLE booking_benefit_requests;`);
};
