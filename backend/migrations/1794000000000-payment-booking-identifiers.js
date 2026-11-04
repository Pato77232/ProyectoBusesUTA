exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE payment_proofs ALTER COLUMN booking_id TYPE text USING booking_id::text,
      ADD CONSTRAINT payment_proofs_booking_id_nonempty CHECK(length(btrim(booking_id))>0);
    ALTER TABLE payment_proof_notification_outbox ALTER COLUMN booking_id TYPE text USING booking_id::text,
      ADD CONSTRAINT payment_outbox_booking_id_nonempty CHECK(length(btrim(booking_id))>0);`);
};

exports.down = (pgm) => {
  pgm.sql(`DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM payment_proofs WHERE booking_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      OR EXISTS(SELECT 1 FROM payment_proof_notification_outbox WHERE booking_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
      RAISE EXCEPTION 'Los identificadores opacos requieren un plan de reversión sin pérdida de identidad.' USING ERRCODE='23514';
    END IF;
    END $$;
    ALTER TABLE payment_proofs DROP CONSTRAINT payment_proofs_booking_id_nonempty,
      ALTER COLUMN booking_id TYPE uuid USING booking_id::uuid;
    ALTER TABLE payment_proof_notification_outbox DROP CONSTRAINT payment_outbox_booking_id_nonempty,
      ALTER COLUMN booking_id TYPE uuid USING booking_id::uuid;`);
};
