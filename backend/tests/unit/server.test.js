jest.mock('../../src/app', () => jest.fn());
jest.mock('../../src/shared/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('../../src/shared/database', () => ({ createPool: jest.fn() }));
jest.mock('../../src/modules/auth', () => ({ createAuthModule: jest.fn() }));
jest.mock('../../src/modules/tenants', () => ({ createTenantsModule: jest.fn() }));
jest.mock('../../src/modules/fleet', () => ({ createFleetModule: jest.fn() }));
jest.mock('../../src/modules/frequencies', () => ({ createFrequenciesModule: jest.fn() }));
jest.mock('../../src/modules/route-sheets', () => ({ createRouteSheetsModule: jest.fn() }));
jest.mock('../../src/modules/payments', () => ({ createPaymentsModule: jest.fn() }));

const createApp = require('../../src/app');
const { createPool } = require('../../src/shared/database');
const { createAuthModule } = require('../../src/modules/auth');
const { createTenantsModule } = require('../../src/modules/tenants');
const { createFleetModule } = require('../../src/modules/fleet');
const { createFrequenciesModule } = require('../../src/modules/frequencies');
const { createRouteSheetsModule } = require('../../src/modules/route-sheets');
const { createPaymentsModule } = require('../../src/modules/payments');
const { start } = require('../../src/server');

describe('server startup', () => {
  let pool;
  let auth;
  let frequencies;
  let routeSheets;
  let app;
  let server;

  beforeEach(() => {
    jest.clearAllMocks();

    pool = { query: jest.fn().mockResolvedValue({ rows: [] }), end: jest.fn() };
    auth = { router: {} };
    frequencies = { router: {} };
    routeSheets = { router: {} };
    const fleet = { busGroupQueries: {}, busQueries: {} };
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
    createPaymentsModule.mockReturnValue({});
    createApp.mockReturnValue(app);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('composes Route Sheets with the public Fleet and frequency queries before listening', async () => {
    const processOnce = jest.spyOn(process, 'once').mockImplementation(() => process);

    const result = await start({ PORT: '3100', DATABASE_URL: 'postgres://test' });

    expect(createFrequenciesModule).toHaveBeenCalledWith({ pool, auth });
    expect(createRouteSheetsModule).toHaveBeenCalledWith({
      pool,
      auth,
      frequencyQueries: frequencies.frequencyQueries,
      busGroupQueries: expect.any(Object),
      busQueries: expect.any(Object),
    });
    expect(createApp).toHaveBeenCalledWith(
      expect.objectContaining({ frequencies, routeSheets, pool, auth }),
    );
    expect(app.listen).toHaveBeenCalledWith(3100, expect.any(Function));
    expect(result).toEqual({ server, pool });
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
});
