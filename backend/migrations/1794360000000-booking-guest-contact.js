exports.up = (pgm) => {
  pgm.addColumn('bookings', {
    guest_contact_email: { type: 'text' },
  });
  pgm.addConstraint('bookings', 'bookings_guest_contact_check', {
    check: `(
      (owner_id LIKE 'guest:%' AND guest_contact_email IS NOT NULL
       AND guest_contact_email = lower(btrim(guest_contact_email)))
      OR (owner_id NOT LIKE 'guest:%' AND guest_contact_email IS NULL)
    )`,
  });
};

exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM bookings WHERE guest_contact_email IS NOT NULL) THEN
      RAISE EXCEPTION 'Las reservas de invitado requieren conservar su correo acreditado.'
        USING ERRCODE = 'P0001';
    END IF;
  END $$;`);
  pgm.dropConstraint('bookings', 'bookings_guest_contact_check');
  pgm.dropColumn('bookings', 'guest_contact_email');
};
