const createQueries = require('../application/create-booking-ticket-queries');
const PgBookingTicketReader = require('./pg-booking-ticket-reader');
module.exports = function createBookingTicketQueries({ pool } = {}) {
  return createQueries({ reader: new PgBookingTicketReader({ pool }) });
};
