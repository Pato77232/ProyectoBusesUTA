exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE route_sheets
    ADD COLUMN tariff_draft jsonb CHECK (tariff_draft IS NULL OR jsonb_typeof(tariff_draft) = 'object'),
    ADD COLUMN tariff_revision integer NOT NULL DEFAULT 0 CHECK (tariff_revision >= 0),
    ADD COLUMN tariff_updated_by uuid,
    ADD COLUMN tariff_updated_at timestamptz;
    ALTER TABLE route_sheets ADD CONSTRAINT route_sheets_tariff_metadata_check CHECK (
      (tariff_draft IS NULL AND tariff_revision = 0 AND tariff_updated_by IS NULL AND tariff_updated_at IS NULL)
      OR (tariff_draft IS NOT NULL AND tariff_revision > 0 AND tariff_updated_by IS NOT NULL AND tariff_updated_at IS NOT NULL)
    );`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE route_sheets DROP CONSTRAINT route_sheets_tariff_metadata_check,
    DROP COLUMN tariff_draft, DROP COLUMN tariff_revision,
    DROP COLUMN tariff_updated_by, DROP COLUMN tariff_updated_at;`);
};
