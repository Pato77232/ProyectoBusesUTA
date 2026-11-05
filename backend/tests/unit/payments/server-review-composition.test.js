const { EventEmitter } = require('node:events');

jest.mock('../../../src/app', () => jest.fn());
jest.mock('../../../src/shared/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('../../../src/shared/database', () => ({ createPool: jest.fn() }));
jest.mock('../../../src/modules/auth', () => ({
  createAuthModule: jest.fn(),
  createCustomerContactQueries: jest.fn(),
}));
jest.mock('../../../src/modules/tenants', () => ({
  createTenantsModule: jest.fn(),
  createPublicCooperativeQueries: jest.fn(),
}));
jest.mock('../../../src/modules/fleet', () => ({ createFleetModule: jest.fn() }));
jest.mock('../../../src/modules/frequencies', () => ({ createFrequenciesModule: jest.fn() }));
jest.mock('../../../src/modules/route-sheets', () => ({
  createRouteSheetsModule: jest.fn(),
  createFrequencyCommitmentQueries: jest.fn(),
  createPublicTripSearch: jest.fn(),
}));
jest.mock('../../../src/modules/payments', () => ({
  createPaymentsModule: jest.fn(),
  createPaymentReceiptModule: jest.fn(),
  createPaymentReviewModule: jest.fn(),
}));
jest.mock('../../../src/modules/bookings', () => ({
  createBookingsModule: jest.fn(),
  createBookingOccupancyQueries: jest.fn(),
  createBookingTicketQueries: jest.fn(),
  createBookingNotificationQueries: jest.fn(),
}));
jest.mock('../../../src/modules/tickets', () => ({ createTicketsModule: jest.fn() }));
jest.mock('../../../src/modules/notifications', () => ({ createNotificationsModule: jest.fn() }));

const createApp = require('../../../src/app');
const { createPool } = require('../../../src/shared/database');
const { createAuthModule } = require('../../../src/modules/auth');
const { createTenantsModule } = require('../../../src/modules/tenants');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const { createRouteSheetsModule } = require('../../../src/modules/route-sheets');
const {
  createPaymentsModule,
  createPaymentReceiptModule,
  createPaymentReviewModule,
} = require('../../../src/modules/payments');
const { createBookingsModule } = require('../../../src/modules/bookings');
const { createNotificationsModule } = require('../../../src/modules/notifications');
const { start } = require('../../../src/server');

test('server conecta la lectura de pagos a la API pública de reservas', async () => {
  const pool = { query: jest.fn(), end: jest.fn() };
  const auth = { authenticate: jest.fn() };
  const tenants = {};
  const fleet = {};
  const frequencies = {};
  const routeSheets = { tripQueries: { findBookableForSegment: jest.fn() } };
  const payments = { router: {} };
  const paymentReview = { router: {} };
  const paymentReceipt = { bookingPaymentProofNotifier: jest.fn() };
  const bookings = {
    paymentQueries: { findForPayment: jest.fn() },
    saleConfirmer: { confirmSale: jest.fn(), rejectSale: jest.fn() },
    createPaymentProofReceiver: jest.fn(),
    maintenance: {
      startExpirationWorker: jest.fn(() => ({ stop: jest.fn().mockResolvedValue() })),
    },
  };
  const listener = new EventEmitter();
  const app = {
    listen: jest.fn((port, callback) => {
      process.nextTick(callback);
      return listener;
    }),
  };
  listener.close = jest.fn((callback) => {
    listener.emit('close');
    callback();
  });

  createPool.mockReturnValue(pool);
  createAuthModule.mockResolvedValue(auth);
  createTenantsModule.mockReturnValue(tenants);
  createFleetModule.mockReturnValue(fleet);
  createFrequenciesModule.mockReturnValue(frequencies);
  createRouteSheetsModule.mockReturnValue(routeSheets);
  createPaymentsModule.mockReturnValue(payments);
  createBookingsModule.mockReturnValue(bookings);
  createPaymentReceiptModule.mockReturnValue(paymentReceipt);
  createPaymentReviewModule.mockReturnValue(paymentReview);
  createApp.mockReturnValue(app);
  const notifications = {
    outbox: { enqueueWith: jest.fn() },
    maintenance: { startWorker: jest.fn(() => null) },
  };
  createNotificationsModule.mockReturnValue(notifications);

  const env = { DATABASE_URL: 'postgres://qa.invalid/busesuta_test' };
  const result = await start(env);

  expect(createBookingsModule).toHaveBeenCalledWith({
    pool,
    auth,
    env,
    availabilityQueries: routeSheets.tripQueries,
    notificationOutbox: notifications.outbox,
  });
  expect(createPaymentReviewModule).toHaveBeenCalledWith({
    pool,
    auth,
    paymentQueries: bookings.paymentQueries,
    env,
  });
  expect(createPaymentReceiptModule).toHaveBeenCalledWith({
    pool,
    createPaymentProofReceiver: bookings.createPaymentProofReceiver,
  });
  expect(createPaymentsModule).toHaveBeenCalledWith({
    pool,
    auth,
    env,
    paymentQueries: bookings.paymentQueries,
    bookingPaymentProofNotifier: paymentReceipt.bookingPaymentProofNotifier,
    bookingSaleConfirmer: bookings.saleConfirmer,
    notificationOutbox: notifications.outbox,
  });
  expect(createApp).toHaveBeenCalledWith(
    expect.objectContaining({ paymentReview, payments, bookings, auth, pool }),
  );
  await result.stop();
  expect(result.pool).toBe(pool);
  expect(pool.end).toHaveBeenCalledTimes(1);
});
