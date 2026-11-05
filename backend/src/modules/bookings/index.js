const getAccessibleAvailability = require('./application/get-accessible-availability.use-case');
const createBenefitRequests = require('./application/benefit-requests');
const PgBenefitRequestRepository = require('./infrastructure/pg-benefit-request.repository');
const createBenefitRequestRouter = require('./interfaces/benefit-request-router');
const routeSheetAvailabilityCatalog = require('./infrastructure/route-sheet-availability-catalog');
const routeSheetPurchaseCatalog = require('./infrastructure/route-sheet-purchase-catalog');
const expireDueBookings = require('./application/expire-due-bookings.use-case');
const readExpirationConfig = require('./infrastructure/expiration-worker-config');
const startExpirationWorker = require('./infrastructure/booking-expiration-worker');
const expirationFailure = require('./domain/expiration-failure');
const PgBookingLifecycleRepository = require('./infrastructure/pg-booking-lifecycle.repository');
const receivePaymentProof = require('./application/receive-payment-proof.use-case');
const expireBooking = require('./application/expire-booking.use-case');
const { randomUUID, createHash } = require('node:crypto');
const PgBookingRepository = require('./infrastructure/pg-booking.repository');
const createVerifiedCustomerIdentity = require('./infrastructure/verified-customer-identity');
const readBookingConfig = require('./infrastructure/booking-config');
const defaultCalendarDateAt = require('./infrastructure/booking-clock');
const getSeatAvailability = require('./application/get-seat-availability.use-case');
const getBookingSummary = require('./application/get-booking-summary.use-case');
const createBooking = require('./application/create-booking.use-case');
const getBookingAttempt = require('./application/get-booking-attempt.use-case');
const getBookingHistory = require('./application/get-booking-history.use-case');
const findForPayment = require('./application/find-for-payment.use-case');
const createRouter = require('./interfaces/booking-router');
const createGuestBookingRouter = require('./interfaces/guest-booking-router');
const { createGuestAccess } = require('./application/guest-access');
const BookingServiceUnavailableError = require('./domain/booking-service-unavailable-error');
const PgBookingSaleConfirmer = require('./infrastructure/pg-booking-sale-confirmer');
const PgBenefitReviewRepository = require('./infrastructure/pg-benefit-review.repository');
const createBenefitReviews = require('./application/benefit-reviews');
const createBenefitReviewRouter = require('./interfaces/benefit-review-router');

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
  passengerVerifier,
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
    (passengerVerifier !== undefined && typeof passengerVerifier?.verify !== 'function')
  ) {
    throw new Error('No se pudo componer el módulo de reservas.');
  }
  const segmentCatalog =
    availabilityQueries === null
      ? undefined
      : routeSheetAvailabilityCatalog({ tripQueries: availabilityQueries });
  const repository = new PgBookingRepository({ pool });
  const purchaseCatalog =
    typeof availabilityQueries?.findPurchaseContext === 'function'
      ? routeSheetPurchaseCatalog({ tripQueries: availabilityQueries })
      : null;
  const benefitReviews = purchaseCatalog
    ? createBenefitReviews({
        repository: new PgBenefitReviewRepository(pool),
        purchaseCatalog,
        clock,
        calendarDateAt,
      })
    : null;
  const dependencies = {
    repository,
    tripCatalog,
    purchaseCatalog,
    passengerVerifier: passengerVerifier ??
      benefitReviews ?? {
        async verify() {
          throw new BookingServiceUnavailableError('BOOKING_BENEFIT_SERVICE_UNAVAILABLE');
        },
      },
    clock,
    calendarDateAt,
    newId,
    buyerIdentity: createVerifiedCustomerIdentity(),
    ...readBookingConfig(env),
  };
  const lifecycle = new PgBookingLifecycleRepository({ pool });
  const saleConfirmer = new PgBookingSaleConfirmer({ pool, clock });
  const guestAccess = createGuestAccess({ pool, clock });
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
    saleConfirmer,
    guestAccess,
    guestRouter: createGuestBookingRouter({ guestAccess }),
    benefitRequestRouter: createBenefitRequestRouter({
      auth,
      requests: createBenefitRequests({
        repository: new PgBenefitRequestRepository(pool),
        purchaseCatalog,
        clock,
        calendarDateAt,
        newId,
        fingerprint: (value) => createHash('sha256').update(value).digest('hex'),
      }),
    }),
    benefitReviewRouter: benefitReviews
      ? createBenefitReviewRouter({ auth, reviews: benefitReviews })
      : undefined,
    router: createRouter({
      auth,
      getSeatAvailability: getSeatAvailability({
        tripCatalog,
        segmentCatalog,
        allocationReader: repository,
      }),
      getAccessibleAvailability: getAccessibleAvailability({
        purchaseCatalog,
        allocationReader: repository,
      }),
      getBookingSummary: getBookingSummary(dependencies),
      createBooking: createBooking(dependencies),
      getBookingAttempt: getBookingAttempt(dependencies),
      getBookingHistory: getBookingHistory({ repository }),
    }),
  };
}
const createBookingOccupancyQueries = require('./infrastructure/create-booking-occupancy-queries');

const createBookingTicketQueries = require('./infrastructure/create-booking-ticket-queries');
module.exports = {
  createBookingsModule,
  createBookingOccupancyQueries,
  createBookingTicketQueries,
};
