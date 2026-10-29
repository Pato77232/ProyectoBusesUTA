const { randomUUID } = require('node:crypto');
const PgBookingRepository = require('./infrastructure/pg-booking.repository');
const createVerifiedCustomerIdentity = require('./infrastructure/verified-customer-identity');
const readBookingConfig = require('./infrastructure/booking-config');
const defaultCalendarDateAt = require('./infrastructure/booking-clock');
const getSeatAvailability = require('./application/get-seat-availability.use-case');
const getBookingSummary = require('./application/get-booking-summary.use-case');
const createBooking = require('./application/create-booking.use-case');
const createRouter = require('./interfaces/booking-router');
const BookingServiceUnavailableError = require('./domain/booking-service-unavailable-error');

function createBookingsModule({
  pool,
  auth,
  env = process.env,
  tripCatalog = {
    async findBookableById() {
      throw new BookingServiceUnavailableError();
    },
  },
  passengerVerifier = {
    async verify() {
      throw new BookingServiceUnavailableError('BOOKING_BENEFIT_SERVICE_UNAVAILABLE');
    },
  },
  clock = () => new Date(),
  calendarDateAt = defaultCalendarDateAt,
  newId = randomUUID,
} = {}) {
  if (
    !pool ||
    typeof pool.connect !== 'function' ||
    !['authenticate', 'authorize', 'csrfProtection'].every(
      (name) => typeof auth?.[name] === 'function',
    ) ||
    typeof tripCatalog?.findBookableById !== 'function' ||
    typeof passengerVerifier?.verify !== 'function'
  ) {
    throw new Error('No se pudo componer el módulo de reservas.');
  }
  const repository = new PgBookingRepository({ pool });
  const dependencies = {
    repository,
    tripCatalog,
    passengerVerifier,
    clock,
    calendarDateAt,
    newId,
    buyerIdentity: createVerifiedCustomerIdentity(),
    ...readBookingConfig(env),
  };
  return {
    router: createRouter({
      auth,
      getSeatAvailability: getSeatAvailability({ tripCatalog, allocationReader: repository }),
      getBookingSummary: getBookingSummary(dependencies),
      createBooking: createBooking(dependencies),
    }),
  };
}
module.exports = { createBookingsModule };
