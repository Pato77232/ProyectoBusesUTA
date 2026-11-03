exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE booking_trip_locks (
      cooperative_id text NOT NULL CHECK (length(btrim(cooperative_id)) > 0),
      trip_id text NOT NULL CHECK (length(btrim(trip_id)) > 0),
      PRIMARY KEY (cooperative_id, trip_id)
    );
    CREATE TABLE bookings (
      id text PRIMARY KEY CHECK (length(btrim(id)) > 0),
      cooperative_id text NOT NULL,
      trip_id text NOT NULL,
      owner_id text NOT NULL CHECK (length(btrim(owner_id)) > 0),
      from_position bigint NOT NULL CHECK (from_position >= 0),
      to_position bigint NOT NULL CHECK (to_position <= 9007199254740991),
      status text NOT NULL CHECK (status = 'PENDING_PAYMENT'),
      summary jsonb NOT NULL CHECK (jsonb_typeof(summary) = 'object'),
      base_price_cents bigint NOT NULL CHECK (base_price_cents > 0 AND base_price_cents <= 9007199254740991),
      discount_cents bigint NOT NULL CHECK (discount_cents >= 0),
      total_price_cents bigint NOT NULL CHECK (total_price_cents > 0),
      created_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      CONSTRAINT bookings_range_check CHECK (from_position < to_position),
      CONSTRAINT bookings_totals_check CHECK (base_price_cents = discount_cents + total_price_cents),
      CONSTRAINT bookings_window_check CHECK (
        expires_at >= created_at + interval '180 seconds' AND
        expires_at <= created_at + interval '300 seconds'
      ),
      CONSTRAINT bookings_scope_unique UNIQUE (id, cooperative_id, trip_id),
      FOREIGN KEY (cooperative_id, trip_id) REFERENCES booking_trip_locks(cooperative_id, trip_id)
    );
    CREATE INDEX bookings_owner_idx ON bookings (cooperative_id, owner_id, id);
    CREATE TABLE booking_seat_allocations (
      booking_id text NOT NULL,
      cooperative_id text NOT NULL,
      trip_id text NOT NULL,
      seat_id text NOT NULL CHECK (length(btrim(seat_id)) > 0),
      from_position bigint NOT NULL CHECK (from_position >= 0),
      to_position bigint NOT NULL CHECK (to_position <= 9007199254740991 AND to_position > from_position),
      status text NOT NULL CHECK (status IN ('RESERVED', 'SOLD')),
      active boolean NOT NULL DEFAULT true,
      PRIMARY KEY (booking_id, seat_id),
      FOREIGN KEY (booking_id, cooperative_id, trip_id)
        REFERENCES bookings(id, cooperative_id, trip_id) ON DELETE CASCADE
    );
    CREATE INDEX booking_allocations_trip_idx ON booking_seat_allocations (cooperative_id, trip_id) WHERE active;
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('booking_seat_allocations');
  pgm.dropTable('bookings');
  pgm.dropTable('booking_trip_locks');
};
