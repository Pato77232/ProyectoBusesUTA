exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE route_sheets
    ADD COLUMN tariff_frozen jsonb,
    ADD COLUMN tariff_frozen_revision integer,
    ADD COLUMN tariff_frozen_at timestamptz,
    ADD COLUMN tariff_frozen_by uuid;
    ALTER TABLE route_sheets ADD CONSTRAINT route_sheets_frozen_tariff_check CHECK (
      (tariff_frozen IS NULL AND tariff_frozen_revision IS NULL AND tariff_frozen_at IS NULL AND tariff_frozen_by IS NULL)
      OR (tariff_frozen IS NOT NULL AND jsonb_typeof(tariff_frozen) = 'object'
        AND tariff_frozen_revision IS NOT NULL AND tariff_frozen_revision > 0
        AND tariff_frozen_at IS NOT NULL AND tariff_frozen_by IS NOT NULL AND status = 'PUBLISHED')
    );
    CREATE FUNCTION protect_route_sheet_frozen_tariff() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.tariff_frozen IS NOT NULL AND (
        NEW.tariff_frozen IS DISTINCT FROM OLD.tariff_frozen OR
        NEW.tariff_frozen_revision IS DISTINCT FROM OLD.tariff_frozen_revision OR
        NEW.tariff_frozen_at IS DISTINCT FROM OLD.tariff_frozen_at OR
        NEW.tariff_frozen_by IS DISTINCT FROM OLD.tariff_frozen_by
      ) THEN
        RAISE EXCEPTION 'La copia comercial publicada es inmutable.' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER route_sheet_frozen_tariff_immutable BEFORE UPDATE ON route_sheets
      FOR EACH ROW EXECUTE FUNCTION protect_route_sheet_frozen_tariff();`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TRIGGER route_sheet_frozen_tariff_immutable ON route_sheets;
    DROP FUNCTION protect_route_sheet_frozen_tariff();
    ALTER TABLE route_sheets DROP CONSTRAINT route_sheets_frozen_tariff_check,
      DROP COLUMN tariff_frozen, DROP COLUMN tariff_frozen_revision,
      DROP COLUMN tariff_frozen_at, DROP COLUMN tariff_frozen_by;`);
};
