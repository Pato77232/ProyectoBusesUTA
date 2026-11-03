exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE route_sheet_commercial_series (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cooperative_id uuid NOT NULL, bus_group_id uuid NOT NULL,
      base_route_sheet_id uuid NOT NULL UNIQUE, base_start_at timestamptz NOT NULL,
      cycle_length_days integer NOT NULL CHECK(cycle_length_days>0), created_by uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(id,cooperative_id),
      FOREIGN KEY(base_route_sheet_id,cooperative_id) REFERENCES route_sheets(id,cooperative_id) ON DELETE RESTRICT
    );
    CREATE INDEX route_commercial_series_group_idx ON route_sheet_commercial_series(cooperative_id,bus_group_id);
    CREATE TABLE route_sheet_commercial_cycles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), route_sheet_id uuid NOT NULL UNIQUE, cooperative_id uuid NOT NULL,
      series_id uuid NOT NULL, cycle_number integer NOT NULL CHECK(cycle_number>0),
      start_at timestamptz NOT NULL, end_exclusive timestamptz NOT NULL CHECK(end_exclusive>start_at),
      programming_revision integer NOT NULL CHECK(programming_revision>0), tariff_revision integer NOT NULL CHECK(tariff_revision>0),
      created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(series_id,cycle_number), UNIQUE(id,route_sheet_id,cooperative_id),
      FOREIGN KEY(series_id,cooperative_id) REFERENCES route_sheet_commercial_series(id,cooperative_id) ON DELETE RESTRICT,
      FOREIGN KEY(route_sheet_id,cooperative_id) REFERENCES route_sheets(id,cooperative_id) ON DELETE RESTRICT
    );
    CREATE TABLE route_sheet_commercial_inventories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), route_sheet_id uuid NOT NULL, cooperative_id uuid NOT NULL, bus_id uuid NOT NULL,
      revision integer NOT NULL CHECK(revision=1), schema_version integer NOT NULL CHECK(schema_version=1),
      snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND snapshot ? 'seats'
        AND jsonb_typeof(snapshot->'seats')='array' AND jsonb_array_length(snapshot->'seats')>0),
      captured_by uuid NOT NULL, captured_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(route_sheet_id,bus_id), UNIQUE(id,route_sheet_id,cooperative_id,bus_id),
      FOREIGN KEY(route_sheet_id,cooperative_id) REFERENCES route_sheets(id,cooperative_id) ON DELETE RESTRICT
    );
    CREATE TABLE route_sheet_trips (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cooperative_id uuid NOT NULL, route_sheet_id uuid NOT NULL,
      assignment_id uuid NOT NULL UNIQUE, required_service_id uuid NOT NULL, frequency_id uuid NOT NULL, bus_id uuid NOT NULL,
      cycle_id uuid NOT NULL, inventory_snapshot_id uuid NOT NULL,
      programming_revision integer NOT NULL CHECK(programming_revision>0), tariff_revision integer NOT NULL CHECK(tariff_revision>0),
      departure_at timestamptz NOT NULL, arrival_at timestamptz NOT NULL CHECK(arrival_at>departure_at),
      route_points jsonb NOT NULL CHECK(jsonb_typeof(route_points)='array' AND jsonb_array_length(route_points)>=2),
      created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(route_sheet_id,cooperative_id) REFERENCES route_sheets(id,cooperative_id) ON DELETE RESTRICT,
      FOREIGN KEY(assignment_id,route_sheet_id,cooperative_id) REFERENCES route_sheet_assignments(id,route_sheet_id,cooperative_id) ON DELETE RESTRICT,
      FOREIGN KEY(required_service_id,route_sheet_id,cooperative_id) REFERENCES route_sheet_required_services(id,route_sheet_id,cooperative_id) ON DELETE RESTRICT,
      FOREIGN KEY(cycle_id,route_sheet_id,cooperative_id) REFERENCES route_sheet_commercial_cycles(id,route_sheet_id,cooperative_id) ON DELETE RESTRICT,
      FOREIGN KEY(inventory_snapshot_id,route_sheet_id,cooperative_id,bus_id) REFERENCES route_sheet_commercial_inventories(id,route_sheet_id,cooperative_id,bus_id) ON DELETE RESTRICT
    );
    CREATE INDEX route_trips_departure_idx ON route_sheet_trips(cooperative_id,departure_at);
    CREATE FUNCTION protect_route_commercial_record() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'El registro comercial es inmutable.' USING ERRCODE='23514'; END; $$;
  `);
  for (const table of [
    'route_sheet_trips',
    'route_sheet_commercial_inventories',
    'route_sheet_commercial_cycles',
    'route_sheet_commercial_series',
  ])
    pgm.sql(`CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION protect_route_commercial_record();`);
};

exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM route_sheet_commercial_series)
      OR EXISTS(SELECT 1 FROM route_sheet_commercial_cycles)
      OR EXISTS(SELECT 1 FROM route_sheet_trips)
      OR EXISTS(SELECT 1 FROM route_sheet_commercial_inventories) THEN
    RAISE EXCEPTION 'No se puede revertir con información comercial persistida.';
    END IF; END $$;
    DROP TABLE route_sheet_trips,route_sheet_commercial_inventories,route_sheet_commercial_cycles,route_sheet_commercial_series;
    DROP FUNCTION protect_route_commercial_record();`);
};
