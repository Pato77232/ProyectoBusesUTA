exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE bus_seats DROP CONSTRAINT bus_seats_category_check;
    ALTER TABLE bus_seats ADD CONSTRAINT bus_seats_category_check CHECK (category IN ('NORMAL','VIP','ACCESSIBLE'));
    ALTER TABLE bus_seats ADD CONSTRAINT bus_seats_accessible_not_offered CHECK (category <> 'ACCESSIBLE' OR NOT offered);`);
};
exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE bus_seats DROP CONSTRAINT bus_seats_category_check;
    ALTER TABLE bus_seats ADD CONSTRAINT bus_seats_category_check CHECK (category IN ('NORMAL','VIP'));
    ALTER TABLE bus_seats DROP CONSTRAINT bus_seats_accessible_not_offered;`);
};
