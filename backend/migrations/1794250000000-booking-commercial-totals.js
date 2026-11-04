exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE bookings
    ADD COLUMN vip_surcharge_cents bigint NOT NULL DEFAULT 0 CHECK(vip_surcharge_cents >= 0),
    ADD COLUMN rounding_adjustment_cents bigint NOT NULL DEFAULT 0,
    DROP CONSTRAINT bookings_totals_check,
    ADD CONSTRAINT bookings_totals_check CHECK(
      base_price_cents + vip_surcharge_cents - discount_cents + rounding_adjustment_cents = total_price_cents
    );`);
};
exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM bookings WHERE vip_surcharge_cents<>0 OR rounding_adjustment_cents<>0) THEN
      RAISE EXCEPTION 'Los importes comerciales requieren un plan de reversión sin pérdida de datos.';
    END IF;
    END $$;
    ALTER TABLE bookings DROP CONSTRAINT bookings_totals_check,
      ADD CONSTRAINT bookings_totals_check CHECK(base_price_cents=discount_cents+total_price_cents),
      DROP COLUMN vip_surcharge_cents, DROP COLUMN rounding_adjustment_cents;`);
};
