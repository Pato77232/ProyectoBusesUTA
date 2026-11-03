// Originales históricos intactos: se aplican como una sola entrada posterior a develop.
const schema = require('./1793145600000-create-bookings');
const idempotency = require('./1793232000000-booking-creation-idempotency');
const paymentRead = require('./1793740000000-booking-payment-read-context');

exports.up = (pgm) => {
  schema.up(pgm);
  idempotency.up(pgm);
  paymentRead.up(pgm);
};

exports.down = (pgm) => {
  paymentRead.down(pgm);
  idempotency.down(pgm);
  schema.down(pgm);
};
