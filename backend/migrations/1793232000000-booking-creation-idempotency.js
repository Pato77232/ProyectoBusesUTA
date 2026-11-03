exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE bookings
      ADD COLUMN creation_request_key uuid,
      ADD COLUMN creation_request_fingerprint text,
      ADD CONSTRAINT bookings_creation_request_check CHECK (
        (creation_request_key IS NULL AND creation_request_fingerprint IS NULL)
        OR
        (creation_request_key IS NOT NULL AND creation_request_fingerprint IS NOT NULL
          AND creation_request_key::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND creation_request_fingerprint ~ '^[0-9a-f]{64}$')
      );
    CREATE UNIQUE INDEX bookings_creation_request_unique ON bookings (owner_id, creation_request_key)
      WHERE creation_request_key IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX bookings_creation_request_unique;
    ALTER TABLE bookings DROP CONSTRAINT bookings_creation_request_check,
      DROP COLUMN creation_request_key, DROP COLUMN creation_request_fingerprint;
  `);
};
