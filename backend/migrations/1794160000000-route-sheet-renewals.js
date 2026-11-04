exports.up = (pgm) => {
  pgm.sql(`CREATE TABLE route_sheet_renewals (
    cooperative_id uuid NOT NULL, request_key uuid NOT NULL,
    source_route_sheet_id uuid NOT NULL, target_route_sheet_id uuid NOT NULL UNIQUE,
    series_id uuid NOT NULL, bus_group_id uuid NOT NULL,
    source_programming_revision integer NOT NULL CHECK(source_programming_revision>0),
    source_tariff_revision integer NOT NULL CHECK(source_tariff_revision>0),
    start_at timestamptz NOT NULL, end_exclusive timestamptz NOT NULL CHECK(end_exclusive>start_at),
    created_by uuid NOT NULL, created_at timestamptz NOT NULL, response jsonb NOT NULL,
    PRIMARY KEY(cooperative_id,request_key), UNIQUE(cooperative_id,series_id,start_at),
    CHECK(source_route_sheet_id<>target_route_sheet_id),
    FOREIGN KEY(source_route_sheet_id,cooperative_id) REFERENCES route_sheets(id,cooperative_id) ON DELETE RESTRICT,
    FOREIGN KEY(target_route_sheet_id,cooperative_id) REFERENCES route_sheets(id,cooperative_id) ON DELETE RESTRICT,
    FOREIGN KEY(series_id,cooperative_id) REFERENCES route_sheet_commercial_series(id,cooperative_id) ON DELETE RESTRICT
  );
  CREATE FUNCTION protect_route_renewal() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN RAISE EXCEPTION 'La procedencia de renovación es inmutable.' USING ERRCODE='23514'; END; $$;
  CREATE TRIGGER route_renewal_immutable BEFORE UPDATE OR DELETE ON route_sheet_renewals
    FOR EACH ROW EXECUTE FUNCTION protect_route_renewal();
  CREATE FUNCTION check_renewal_commercial_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF EXISTS(SELECT 1 FROM route_sheet_renewals r WHERE r.target_route_sheet_id=NEW.route_sheet_id
      AND (r.cooperative_id<>NEW.cooperative_id OR r.series_id<>NEW.series_id
        OR r.start_at<>NEW.start_at OR r.end_exclusive<>NEW.end_exclusive)) THEN
      RAISE EXCEPTION 'El ciclo no corresponde a su renovación.' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END; $$;
  CREATE TRIGGER renewal_cycle_binding BEFORE INSERT ON route_sheet_commercial_cycles
    FOR EACH ROW EXECUTE FUNCTION check_renewal_commercial_cycle();`);
};

exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM route_sheet_renewals) THEN
    RAISE EXCEPTION 'No se puede destruir la procedencia de renovaciones.'; END IF; END $$;
    DROP TRIGGER renewal_cycle_binding ON route_sheet_commercial_cycles;
    DROP FUNCTION check_renewal_commercial_cycle();
    DROP TABLE route_sheet_renewals; DROP FUNCTION protect_route_renewal();`);
};
