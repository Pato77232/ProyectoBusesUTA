exports.up = (pgm) => {
  pgm.sql(`CREATE TABLE tickets (
    id uuid PRIMARY KEY,
    cooperative_id text NOT NULL CHECK (length(btrim(cooperative_id)) > 0),
    booking_id text NOT NULL CHECK (length(btrim(booking_id)) > 0),
    seat_id text NOT NULL CHECK (length(btrim(seat_id)) > 0),
    code text NOT NULL CHECK (code ~ '^[A-Z2-7]{26}$'),
    issued_at timestamptz NOT NULL,
    CONSTRAINT tickets_code_unique UNIQUE (code),
    CONSTRAINT tickets_booking_seat_unique UNIQUE (booking_id, seat_id)
  );`);
};
exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM tickets) THEN
      RAISE EXCEPTION 'Los boletos emitidos requieren un plan de reversión sin pérdida de datos.';
    END IF;
  END $$;
  DROP TABLE tickets;`);
};
