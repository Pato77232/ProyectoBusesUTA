exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE bus_groups ADD CONSTRAINT bus_groups_id_cooperative_unique UNIQUE (id, cooperative_id);
    CREATE TABLE buses (
      id uuid PRIMARY KEY,
      cooperative_id uuid NOT NULL REFERENCES cooperatives(id) ON DELETE RESTRICT,
      bus_group_id uuid NOT NULL,
      plate text NOT NULL CHECK (plate ~ '^[A-Z]{3}[0-9]{4}$'),
      vin text NOT NULL CHECK (length(btrim(vin)) > 0 AND vin = btrim(vin) AND vin = upper(vin)),
      unit_number bigint NOT NULL CHECK (unit_number BETWEEN 1 AND 9007199254740991),
      bodywork_brand text NOT NULL CHECK (length(btrim(bodywork_brand)) > 0),
      color text NOT NULL CHECK (length(btrim(color)) > 0),
      seat_layout_id text NOT NULL CHECK (length(seat_layout_id) > 0),
      seat_layout_version integer NOT NULL CHECK (seat_layout_version > 0),
      seat_layout_snapshot jsonb NOT NULL CHECK (jsonb_typeof(seat_layout_snapshot) = 'object'),
      capacity integer NOT NULL CHECK (capacity > 0),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT buses_plate_unique UNIQUE (plate),
      CONSTRAINT buses_vin_unique UNIQUE (vin),
      CONSTRAINT buses_cooperative_unit_unique UNIQUE (cooperative_id, unit_number),
      CONSTRAINT buses_id_cooperative_unique UNIQUE (id, cooperative_id),
      CONSTRAINT buses_bus_group_tenant_fk FOREIGN KEY (bus_group_id, cooperative_id)
        REFERENCES bus_groups(id, cooperative_id) ON DELETE RESTRICT
    );
    CREATE INDEX buses_cooperative_id_idx ON buses(cooperative_id);
    CREATE TABLE bus_seats (
      id uuid PRIMARY KEY,
      bus_id uuid NOT NULL,
      cooperative_id uuid NOT NULL,
      layout_seat_key text NOT NULL CHECK (length(layout_seat_key) > 0),
      label integer NOT NULL CHECK (label > 0),
      deck integer NOT NULL CHECK (deck IN (1, 2)),
      row_index integer NOT NULL CHECK (row_index >= 0),
      column_index integer NOT NULL CHECK (column_index >= 0),
      category text NOT NULL CHECK (category = 'NORMAL'),
      offered boolean NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT bus_seats_bus_tenant_fk FOREIGN KEY (bus_id, cooperative_id)
        REFERENCES buses(id, cooperative_id) ON DELETE CASCADE,
      CONSTRAINT bus_seats_position_unique UNIQUE (bus_id, layout_seat_key),
      CONSTRAINT bus_seats_label_unique UNIQUE (bus_id, label),
      CONSTRAINT bus_seats_coordinates_unique UNIQUE (bus_id, deck, row_index, column_index)
    );
    CREATE INDEX bus_seats_cooperative_bus_idx ON bus_seats(cooperative_id, bus_id);
    CREATE TABLE bus_photos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bus_id uuid NOT NULL,
      cooperative_id uuid NOT NULL,
      storage_key uuid NOT NULL,
      content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
      size integer NOT NULL CHECK (size BETWEEN 1 AND 5000000),
      sort_order integer NOT NULL CHECK (sort_order BETWEEN 0 AND 9),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT bus_photos_bus_tenant_fk FOREIGN KEY (bus_id, cooperative_id)
        REFERENCES buses(id, cooperative_id) ON DELETE CASCADE,
      CONSTRAINT bus_photos_storage_key_unique UNIQUE (storage_key),
      CONSTRAINT bus_photos_order_unique UNIQUE (bus_id, sort_order)
    );
    CREATE INDEX bus_photos_cooperative_bus_idx ON bus_photos(cooperative_id, bus_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE bus_photos;
    DROP TABLE bus_seats;
    DROP TABLE buses;
    ALTER TABLE bus_groups DROP CONSTRAINT bus_groups_id_cooperative_unique;
  `);
};
