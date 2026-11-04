const routeSheetAvailabilityCatalog = require('./infrastructure/route-sheet-availability-catalog');
const expireDueBookings = require('./application/expire-due-bookings.use-case');
const readExpirationConfig = require('./infrastructure/expiration-worker-config');
const startExpirationWorker = require('./infrastructure/booking-expiration-worker');
const expirationFailure = require('./domain/expiration-failure');
const PgBookingLifecycleRepository = require('./infrastructure/pg-booking-lifecycle.repository');
const receivePaymentProof = require('./application/receive-payment-proof.use-case');
const expireBooking = require('./application/expire-booking.use-case');
const confirmSale = require('./application/confirm-sale.use-case');
const { randomUUID } = require('node:crypto');
const PgBookingRepository = require('./infrastructure/pg-booking.repository');
const createVerifiedCustomerIdentity = require('./infrastructure/verified-customer-identity');
const readBookingConfig = require('./infrastructure/booking-config');
const defaultCalendarDateAt = require('./infrastructure/booking-clock');
const getSeatAvailability = require('./application/get-seat-availability.use-case');
const getBookingSummary = require('./application/get-booking-summary.use-case');
const createBooking = require('./application/create-booking.use-case');
const getBookingAttempt = require('./application/get-booking-attempt.use-case');
const findForPayment = require('./application/find-for-payment.use-case');
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
  availabilityQueries = null,
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
  const segmentCatalog =
    availabilityQueries === null
      ? undefined
      : routeSheetAvailabilityCatalog({ tripQueries: availabilityQueries });
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
  const lifecycle = new PgBookingLifecycleRepository({ pool });
  const expirationConfig = readExpirationConfig(env);
  const expire = expireBooking({ repository: lifecycle, clock });
  const coordinator = (onFailure) =>
    expireDueBookings({
      reader: lifecycle,
      expireBooking: expire,
      clock,
      batchSize: expirationConfig.batchSize,
      onFailure,
    });
  return {
    createPaymentSaleConfirmer({ approvalSource } = {}) {
      return Object.freeze({
        confirmSale: confirmSale({ repository: lifecycle, approvalSource, clock }),
      });
    },
    createPaymentProofReceiver({ receiptSource } = {}) {
      return Object.freeze({
        markPaymentProofReceived: receivePaymentProof({
          repository: lifecycle,
          receiptSource,
          clock,
        }),
      });
    },

    maintenance: Object.freeze({
      expireBooking: expire,
      runExpirationBatch: coordinator(),
      startExpirationWorker({ onFailure = () => {} } = {}) {
        return startExpirationWorker({
          runBatch: coordinator((error) => onFailure(expirationFailure(error, 'booking'))),
          enabled: expirationConfig.enabled,
          intervalMs: expirationConfig.intervalMs,
          onError: (error) => onFailure(expirationFailure(error, 'batch')),
        });
      },
    }),
    paymentQueries: Object.freeze({ findForPayment: findForPayment({ repository, clock }) }),
    router: createRouter({
      auth,
      getSeatAvailability: getSeatAvailability({
        tripCatalog,
        segmentCatalog,
        allocationReader: repository,
      }),
      getBookingSummary: getBookingSummary(dependencies),
      createBooking: createBooking(dependencies),
      getBookingAttempt: getBookingAttempt(dependencies),
    }),
  };
}
module.exports = { createBookingsModule };
