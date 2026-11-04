exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE route_sheets ADD CONSTRAINT route_sheets_programming_owner_unique UNIQUE(id, cooperative_id);
    CREATE TABLE route_sheet_programmings (
      route_sheet_id uuid PRIMARY KEY, cooperative_id uuid NOT NULL,
      revision integer NOT NULL CHECK (revision > 0), schema_version integer NOT NULL CHECK (schema_version = 1),
      cycle_start_date date NOT NULL, cycle_length_days integer NOT NULL CHECK (cycle_length_days > 0),
      start_at timestamptz NOT NULL, end_exclusive timestamptz NOT NULL CHECK (end_exclusive > start_at),
      updated_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(route_sheet_id, cooperative_id),
      FOREIGN KEY(route_sheet_id, cooperative_id) REFERENCES route_sheets(id, cooperative_id) ON DELETE CASCADE
    );
    CREATE TABLE route_sheet_programming_ids (
      id uuid PRIMARY KEY, route_sheet_id uuid NOT NULL, cooperative_id uuid NOT NULL,
      kind text NOT NULL CHECK(kind IN ('REQUIRED','SERVICE','TRANSFER','REST','MAINTENANCE')),
      frequency_id uuid, departure_at timestamptz,
      FOREIGN KEY(route_sheet_id, cooperative_id) REFERENCES route_sheet_programmings(route_sheet_id, cooperative_id) ON DELETE CASCADE
    );
    CREATE TABLE route_sheet_required_services (
      id uuid PRIMARY KEY REFERENCES route_sheet_programming_ids(id), route_sheet_id uuid NOT NULL, cooperative_id uuid NOT NULL,
      frequency_id uuid NOT NULL, departure_at timestamptz NOT NULL,
      UNIQUE(route_sheet_id, frequency_id, departure_at), UNIQUE(id, route_sheet_id, cooperative_id),
      FOREIGN KEY(route_sheet_id, cooperative_id) REFERENCES route_sheet_programmings(route_sheet_id, cooperative_id) ON DELETE CASCADE
    );
    CREATE TABLE route_sheet_bus_availability (
      route_sheet_id uuid NOT NULL, cooperative_id uuid NOT NULL, bus_id uuid NOT NULL,
      available_at timestamptz NOT NULL, location_key text NOT NULL CHECK(length(trim(location_key)) > 0),
      PRIMARY KEY(route_sheet_id, bus_id),
      FOREIGN KEY(route_sheet_id, cooperative_id) REFERENCES route_sheet_programmings(route_sheet_id, cooperative_id) ON DELETE CASCADE
    );
    ALTER TABLE route_sheet_assignments ADD COLUMN required_service_id uuid,
      ADD COLUMN departure_at timestamptz, ADD COLUMN arrival_at timestamptz,
      ADD COLUMN preparation_minutes bigint,
      ADD CONSTRAINT route_assignments_programming_check CHECK (
        (required_service_id IS NULL AND departure_at IS NULL AND arrival_at IS NULL AND preparation_minutes IS NULL)
        OR (required_service_id IS NOT NULL AND departure_at IS NOT NULL AND arrival_at IS NOT NULL
          AND preparation_minutes IS NOT NULL AND arrival_at > departure_at AND preparation_minutes >= 0)),
      ADD CONSTRAINT route_assignments_required_fk FOREIGN KEY(required_service_id, route_sheet_id, cooperative_id)
        REFERENCES route_sheet_required_services(id, route_sheet_id, cooperative_id),
      ADD CONSTRAINT route_assignments_programming_unique UNIQUE(id, route_sheet_id, cooperative_id);
    DROP INDEX route_sheet_assignments_sheet_bus_unique;
    DROP INDEX route_sheet_assignments_sheet_frequency_unique;
    CREATE UNIQUE INDEX route_assignments_legacy_bus_unique ON route_sheet_assignments(route_sheet_id,bus_id) WHERE required_service_id IS NULL;
    CREATE UNIQUE INDEX route_assignments_legacy_frequency_unique ON route_sheet_assignments(route_sheet_id,frequency_id) WHERE required_service_id IS NULL;
    CREATE UNIQUE INDEX route_assignments_required_unique ON route_sheet_assignments(required_service_id) WHERE required_service_id IS NOT NULL;
    CREATE UNIQUE INDEX route_assignments_departure_unique ON route_sheet_assignments(route_sheet_id,frequency_id,departure_at) WHERE required_service_id IS NOT NULL;
    CREATE TABLE route_sheet_service_points (
      assignment_id uuid NOT NULL, route_sheet_id uuid NOT NULL, cooperative_id uuid NOT NULL,
      position integer NOT NULL CHECK(position >= 0), location_key text NOT NULL CHECK(length(trim(location_key)) > 0),
      arrival_at timestamptz, departure_at timestamptz,
      CHECK(arrival_at IS NOT NULL OR departure_at IS NOT NULL),
      CHECK(arrival_at IS NULL OR departure_at IS NULL OR arrival_at <= departure_at),
      PRIMARY KEY(assignment_id, position),
      FOREIGN KEY(assignment_id, route_sheet_id, cooperative_id) REFERENCES route_sheet_assignments(id, route_sheet_id, cooperative_id) ON DELETE CASCADE
    );
    CREATE TABLE route_sheet_transfers (
      id uuid PRIMARY KEY REFERENCES route_sheet_programming_ids(id), route_sheet_id uuid NOT NULL, cooperative_id uuid NOT NULL, bus_id uuid NOT NULL,
      origin_key text NOT NULL, destination_key text NOT NULL,
      departure_at timestamptz NOT NULL, arrival_at timestamptz NOT NULL CHECK(arrival_at > departure_at),
      preparation_minutes bigint NOT NULL CHECK(preparation_minutes >= 0),
      FOREIGN KEY(route_sheet_id, cooperative_id) REFERENCES route_sheet_programmings(route_sheet_id, cooperative_id) ON DELETE CASCADE
    );
    CREATE TABLE route_sheet_programming_blocks (
      id uuid PRIMARY KEY REFERENCES route_sheet_programming_ids(id), route_sheet_id uuid NOT NULL, cooperative_id uuid NOT NULL, bus_id uuid NOT NULL,
      kind text NOT NULL CHECK(kind IN ('REST','MAINTENANCE')), start_at timestamptz NOT NULL,
      end_at timestamptz NOT NULL CHECK(end_at > start_at), reason text NOT NULL CHECK(length(trim(reason)) > 0),
      FOREIGN KEY(route_sheet_id, cooperative_id) REFERENCES route_sheet_programmings(route_sheet_id, cooperative_id) ON DELETE CASCADE
    );
    CREATE INDEX route_programmings_tenant_period_idx ON route_sheet_programmings(cooperative_id,start_at,end_exclusive);

    CREATE FUNCTION lock_route_programming_writes() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(1793650000);
      RETURN NULL;
    END; $$;
    CREATE FUNCTION guard_route_programming_legacy_write() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE target_id uuid;
    BEGIN
      IF TG_OP = 'DELETE' THEN target_id := OLD.route_sheet_id; ELSE target_id := NEW.route_sheet_id; END IF;
      IF current_setting('busesuta.programming_write', true) IS DISTINCT FROM 'on' THEN
        IF EXISTS(SELECT 1 FROM route_sheet_programmings WHERE route_sheet_id = target_id)
          OR (TG_OP <> 'INSERT' AND EXISTS(SELECT 1 FROM route_sheet_programmings WHERE route_sheet_id = OLD.route_sheet_id)) THEN
          RAISE EXCEPTION 'Usa el reemplazo integral de programación.' USING ERRCODE = '23514';
        END IF;
        IF TG_OP <> 'DELETE' AND EXISTS(SELECT 1 FROM route_sheet_bus_availability
          WHERE cooperative_id = NEW.cooperative_id AND bus_id = NEW.bus_id) THEN
          RAISE EXCEPTION 'El bus requiere programación fechada integral.' USING ERRCODE = '23514';
        END IF;
      END IF;
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END; $$;
    CREATE FUNCTION guard_route_programming_cycles() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS(SELECT 1 FROM route_sheet_programmings p JOIN route_sheets s ON s.id=p.route_sheet_id
        WHERE s.cooperative_id=NEW.cooperative_id AND s.bus_group_id=NEW.bus_group_id) THEN
        RAISE EXCEPTION 'El grupo requiere ciclos con programación integral.' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END; $$;
    CREATE TRIGGER route_sheet_cycles_programming_guard BEFORE INSERT OR UPDATE ON route_sheet_cycles
      FOR EACH ROW EXECUTE FUNCTION guard_route_programming_cycles();
  `);
  // BEFORE STATEMENT se ejecuta antes de locks de filas de los escritores antiguos.
  for (const table of [
    'route_sheets',
    'route_sheet_assignments',
    'route_sheet_rest_days',
    'route_sheet_cycles',
  ]) {
    pgm.sql(`CREATE TRIGGER ${table}_programming_lock BEFORE INSERT OR UPDATE OR DELETE ON ${table}
      FOR EACH STATEMENT EXECUTE FUNCTION lock_route_programming_writes();`);
  }
  for (const table of ['route_sheet_assignments', 'route_sheet_rest_days']) {
    pgm.sql(`CREATE TRIGGER ${table}_programming_guard BEFORE INSERT OR UPDATE OR DELETE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION guard_route_programming_legacy_write();`);
  }
};

exports.down = (pgm) => {
  // No destruir programación ni reintroducir índices incompatibles con datos reales.
  pgm.sql(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM route_sheet_programmings) THEN
    RAISE EXCEPTION 'No se puede revertir con programaciones persistidas.';
    END IF; END $$;`);
  for (const table of ['route_sheet_assignments', 'route_sheet_rest_days']) {
    pgm.sql(`DROP TRIGGER ${table}_programming_guard ON ${table};`);
  }
  for (const table of [
    'route_sheets',
    'route_sheet_assignments',
    'route_sheet_rest_days',
    'route_sheet_cycles',
  ]) {
    pgm.sql(`DROP TRIGGER ${table}_programming_lock ON ${table};`);
  }
  pgm.sql(`DROP TRIGGER route_sheet_cycles_programming_guard ON route_sheet_cycles;
    DROP FUNCTION guard_route_programming_cycles();
    DROP FUNCTION guard_route_programming_legacy_write(); DROP FUNCTION lock_route_programming_writes();
    DROP TABLE route_sheet_programming_blocks, route_sheet_transfers, route_sheet_service_points;
    ALTER TABLE route_sheet_assignments DROP CONSTRAINT route_assignments_required_fk,
      DROP CONSTRAINT route_assignments_programming_unique, DROP CONSTRAINT route_assignments_programming_check;
    DROP INDEX route_assignments_legacy_bus_unique, route_assignments_legacy_frequency_unique, route_assignments_required_unique, route_assignments_departure_unique;
    ALTER TABLE route_sheet_assignments DROP COLUMN required_service_id, DROP COLUMN departure_at, DROP COLUMN arrival_at, DROP COLUMN preparation_minutes;
    CREATE UNIQUE INDEX route_sheet_assignments_sheet_bus_unique ON route_sheet_assignments(route_sheet_id,bus_id);
    CREATE UNIQUE INDEX route_sheet_assignments_sheet_frequency_unique ON route_sheet_assignments(route_sheet_id,frequency_id);
    DROP TABLE route_sheet_bus_availability, route_sheet_required_services, route_sheet_programming_ids, route_sheet_programmings;
    ALTER TABLE route_sheets DROP CONSTRAINT route_sheets_programming_owner_unique;`);
};
