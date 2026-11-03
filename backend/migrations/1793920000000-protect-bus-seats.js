// FLEET-09: Route Sheets copia el inventario al publicar y depende de que no cambie.
// AFTER conserva los códigos de CHECK y unicidad, que se evalúan antes del trigger.
exports.up = (pgm) => {
  pgm.sql(`CREATE FUNCTION protect_bus_seats() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'Los asientos de un bus registrado no se modifican ni se eliminan.'
        USING ERRCODE = '23001';
    END;
    $$;
    CREATE TRIGGER bus_seats_immutable AFTER UPDATE OR DELETE ON bus_seats
      FOR EACH ROW EXECUTE FUNCTION protect_bus_seats();`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TRIGGER bus_seats_immutable ON bus_seats;
    DROP FUNCTION protect_bus_seats();`);
};
