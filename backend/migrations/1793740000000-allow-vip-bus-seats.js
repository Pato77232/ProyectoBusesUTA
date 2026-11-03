exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE bus_seats DROP CONSTRAINT bus_seats_category_check;
    ALTER TABLE bus_seats ADD CONSTRAINT bus_seats_category_check
      CHECK (category IN ('NORMAL', 'VIP'));`);
};

// Con asientos VIP guardados el down falla: no se degradan a NORMAL en silencio.
exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE bus_seats DROP CONSTRAINT bus_seats_category_check;
    ALTER TABLE bus_seats ADD CONSTRAINT bus_seats_category_check
      CHECK (category = 'NORMAL');`);
};
