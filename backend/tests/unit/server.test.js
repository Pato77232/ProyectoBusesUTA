jest.mock('../../src/app', () => jest.fn());
jest.mock('../../src/shared/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('../../src/shared/database', () => ({ createPool: jest.fn() }));
jest.mock('../../src/modules/auth', () => ({ createAuthModule: jest.fn() }));
jest.mock('../../src/modules/tenants', () => ({
  createTenantsModule: jest.fn(),
  createPublicCooperativeQueries: jest.fn(),
}));
jest.mock('../../src/modules/fleet', () => ({ createFleetModule: jest.fn() }));
jest.mock('../../src/modules/frequencies', () => ({ createFrequenciesModule: jest.fn() }));
jest.mock('../../src/modules/route-sheets', () => ({
  createRouteSheetsModule: jest.fn(),
  createFrequencyCommitmentQueries: jest.fn(),
  createPublicTripSearch: jest.fn(),
}));
jest.mock('../../src/modules/payments', () => ({
  createPaymentsModule: jest.fn(),
  createPaymentReceiptModule: jest.fn(),
  createPaymentReviewModule: jest.fn(),
}));
jest.mock('../../src/modules/bookings', () => ({
  createBookingsModule: jest.fn(),
  createBookingOccupancyQueries: jest.fn(),
  createBookingTicketQueries: jest.fn(),
}));
jest.mock('../../src/modules/tickets', () => ({ createTicketsModule: jest.fn() }));

const createApp = require('../../src/app');
const { createPool } = require('../../src/shared/database');
const { createAuthModule } = require('../../src/modules/auth');
const { createTenantsModule } = require('../../src/modules/tenants');
const { createFleetModule } = require('../../src/modules/fleet');
const { createFrequenciesModule } = require('../../src/modules/frequencies');
const { createRouteSheetsModule } = require('../../src/modules/route-sheets');
const { createFrequencyCommitmentQueries } = require('../../src/modules/route-sheets');
const { createBookingOccupancyQueries } = require('../../src/modules/bookings');
const { createPaymentsModule } = require('../../src/modules/payments');
const { createPaymentReceiptModule } = require('../../src/modules/payments');
const { createBookingsModule } = require('../../src/modules/bookings');
const { createBookingTicketQueries } = require('../../src/modules/bookings');
const { createTicketsModule } = require('../../src/modules/tickets');
const { start } = require('../../src/server');

describe('server startup', () => {
  let pool;
  let auth;
  let frequencies;
  let routeSheets;
  let bookings;
  let fleet;
  let app;
  let server;

  beforeEach(() => {
    jest.clearAllMocks();

    pool = { query: jest.fn().mockResolvedValue({ rows: [] }), end: jest.fn() };
    auth = { router: {} };
    frequencies = { router: {} };
    routeSheets = {
      router: {},
      tripQueries: { findBookableForSegment: jest.fn() },
      tariffQueries: {},
    };
    createBookingOccupancyQueries.mockReturnValue({ hasActiveOccupations: jest.fn() });
    createFrequencyCommitmentQueries.mockReturnValue({ forTransaction: jest.fn() });
    fleet = { busGroupQueries: {}, busQueries: {}, seatQueries: {} };
    bookings = {
      router: {},
      paymentQueries: {},
      saleConfirmer: {},
      maintenance: {
        startExpirationWorker: jest.fn(() => ({ stop: jest.fn().mockResolvedValue() })),
      },
    };
    server = { once: jest.fn(), close: jest.fn((callback) => callback()) };
    app = {
      listen: jest.fn((_port, onListening) => {
        process.nextTick(onListening);
        return server;
      }),
    };

    createPool.mockReturnValue(pool);
    createAuthModule.mockResolvedValue(auth);
    createTenantsModule.mockReturnValue({});
    createFleetModule.mockReturnValue(fleet);
    createFrequenciesModule.mockReturnValue(frequencies);
    createRouteSheetsModule.mockReturnValue(routeSheets);
    createPaymentReceiptModule.mockReturnValue({ bookingPaymentProofNotifier: {} });
    createPaymentsModule.mockReturnValue({});
    createBookingsModule.mockReturnValue(bookings);
    createBookingTicketQueries.mockReturnValue({ findSoldForOwner: jest.fn() });
    createTicketsModule.mockReturnValue({ router: {} });
    createApp.mockReturnValue(app);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('composes Route Sheets with the public Fleet and frequency queries before listening', async () => {
    const processOnce = jest.spyOn(process, 'once').mockImplementation(() => process);

    const env = { PORT: '3100', DATABASE_URL: 'postgres://test' };
    const result = await start(env);

    expect(createBookingOccupancyQueries).toHaveBeenCalledWith({ pool });
    const occupancyQueries = createBookingOccupancyQueries.mock.results[0].value;
    expect(createFrequencyCommitmentQueries).toHaveBeenCalledWith({ occupancyQueries });
    expect(createFrequenciesModule).toHaveBeenCalledWith({
      pool,
      auth,
      commitmentQueries: createFrequencyCommitmentQueries.mock.results[0].value,
    });
    expect(createRouteSheetsModule).toHaveBeenCalledWith({
      pool,
      auth,
      frequencyQueries: frequencies.frequencyQueries,
      busGroupQueries: expect.any(Object),
      busQueries: expect.any(Object),
      seatQueries: fleet.seatQueries,
      occupancyQueries,
    });
    expect(createBookingsModule).toHaveBeenCalledWith({
      pool,
      auth,
      env,
      availabilityQueries: routeSheets.tripQueries,
    });
    expect(createPaymentReceiptModule).toHaveBeenCalledWith({
      pool,
      createPaymentProofReceiver: bookings.createPaymentProofReceiver,
    });
    expect(createPaymentsModule).toHaveBeenCalledWith({
      pool,
      auth,
      env,
      bookingPaymentProofNotifier: {},
      bookingSaleConfirmer: bookings.saleConfirmer,
      paymentQueries: bookings.paymentQueries,
    });
    expect(createBookingTicketQueries).toHaveBeenCalledWith({ pool });
    expect(createTicketsModule).toHaveBeenCalledWith({
      pool,
      auth,
      soldBookings: createBookingTicketQueries.mock.results[0].value,
    });
    expect(createApp).toHaveBeenCalledWith(
      expect.objectContaining({ frequencies, routeSheets, bookings, fleet, pool, auth }),
    );
    expect(createApp).toHaveBeenCalledWith(
      expect.objectContaining({ tickets: createTicketsModule.mock.results[0].value }),
    );
    expect(app.listen).toHaveBeenCalledWith(3100, expect.any(Function));
    expect(result).toEqual({ server, pool, stop: expect.any(Function) });
    expect(bookings.maintenance.startExpirationWorker).toHaveBeenCalledWith({
      onFailure: expect.any(Function),
    });
    expect(processOnce).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnce).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('closes the pool when frequencies module creation fails', async () => {
    const initializationError = new Error('No se pudo crear frequencies');
    createFrequenciesModule.mockImplementation(() => {
      throw initializationError;
    });

    await expect(start({ PORT: '3100', DATABASE_URL: 'postgres://test' })).rejects.toBe(
      initializationError,
    );

    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(createApp).not.toHaveBeenCalled();
    expect(app.listen).not.toHaveBeenCalled();
  });
  it('rechaza un catálogo ausente incluso cuando la composición usa dobles', async () => {
    routeSheets.tripQueries = {};
    await expect(start({ PORT: '3100', DATABASE_URL: 'postgres://test' })).rejects.toThrow(
      'catálogo de viajes por tramo',
    );
    expect(createBookingsModule).not.toHaveBeenCalled();
    expect(app.listen).not.toHaveBeenCalled();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
  it('drena la expiración antes de cerrar el pool y detiene de forma idempotente', async () => {
    jest.spyOn(process, 'once').mockImplementation(() => process);
    let release;
    const drain = new Promise((resolve) => {
      release = resolve;
    });
    const worker = { stop: jest.fn(() => drain) };
    bookings.maintenance.startExpirationWorker.mockReturnValue(worker);
    const running = await start({ PORT: '3100', DATABASE_URL: 'postgres://test' });
    const stopping = running.stop();
    expect(running.stop()).toBe(stopping);
    await Promise.resolve();
    expect(worker.stop).toHaveBeenCalledTimes(1);
    expect(pool.end).not.toHaveBeenCalled();
    release();
    await stopping;
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
  it('cierra HTTP y pool si falla el arranque del trabajador', async () => {
    const error = new Error('worker unavailable');
    bookings.maintenance.startExpirationWorker.mockImplementation(() => {
      throw error;
    });
    await expect(start({ PORT: '3100', DATABASE_URL: 'postgres://test' })).rejects.toBe(error);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
  it('espera el drenaje aunque falle el cierre HTTP', async () => {
    jest.spyOn(process, 'once').mockImplementation(() => process);
    let release;
    const drain = new Promise((resolve) => {
      release = resolve;
    });
    bookings.maintenance.startExpirationWorker.mockReturnValue({ stop: () => drain });
    const error = new Error('HTTP close failed');
    server.close.mockImplementation((callback) => callback(error));
    const running = await start({ PORT: '3100', DATABASE_URL: 'postgres://test' });
    const stopping = running.stop();
    const assertion = expect(stopping).rejects.toBe(error);
    await Promise.resolve();
    expect(pool.end).not.toHaveBeenCalled();
    release();
    await assertion;
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
