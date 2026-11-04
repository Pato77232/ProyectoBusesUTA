const configure = require('../../../src/modules/bookings/infrastructure/expiration-worker-config');
const coordinate = require('../../../src/modules/bookings/application/expire-due-bookings.use-case');
const worker = require('../../../src/modules/bookings/infrastructure/booking-expiration-worker');
const safeFailure = require('../../../src/modules/bookings/domain/expiration-failure');
const at = '2026-11-03T15:00:00.000Z';
const row = (id) => ({ bookingId: id, expiresAt: '2026-11-03T14:59:00.000Z' });
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
test('configuración operativa y límites no cambian el plazo de negocio', () => {
  expect(configure({})).toEqual({ enabled: true, intervalMs: 5000, batchSize: 50 });
  expect(
    configure({
      BOOKING_EXPIRATION_ENABLED: 'false',
      BOOKING_EXPIRATION_INTERVAL_MS: '100',
      BOOKING_EXPIRATION_BATCH_SIZE: '500',
    }),
  ).toEqual({ enabled: false, intervalMs: 100, batchSize: 500 });
});
test.each([
  ['BOOKING_EXPIRATION_ENABLED', '0'],
  ['BOOKING_EXPIRATION_ENABLED', true],
  ['BOOKING_EXPIRATION_INTERVAL_MS', '99'],
  ['BOOKING_EXPIRATION_INTERVAL_MS', '60001'],
  ['BOOKING_EXPIRATION_BATCH_SIZE', '0'],
  ['BOOKING_EXPIRATION_BATCH_SIZE', '501'],
  ['BOOKING_EXPIRATION_BATCH_SIZE', '1.1'],
  ['BOOKING_EXPIRATION_BATCH_SIZE', ' 5'],
])('rechaza configuración inválida %s = %s', (key, value) => {
  expect(() => configure({ [key]: value })).toThrow();
});
test('una reserva fallida no bloquea las posteriores y se reintenta en el siguiente pase', async () => {
  const reader = {
    listExpiredCandidates: jest
      .fn()
      .mockResolvedValueOnce([row('a')])
      .mockResolvedValueOnce([row('b')])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row('a')]),
  };
  const expire = jest
    .fn()
    .mockRejectedValueOnce(new Error('bad row'))
    .mockResolvedValue({ outcome: 'EXPIRED' });
  const observe = jest.fn().mockRejectedValue(new Error('observer also fails'));
  const clock = jest.fn(() => new Date(at));
  const run = coordinate({
    reader,
    expireBooking: expire,
    clock,
    batchSize: 1,
    onFailure: observe,
  });
  expect(await run()).toMatchObject({ failed: 1, continuing: true });
  expect(await run()).toMatchObject({ expired: 1 });
  await run();
  await run();
  expect(reader.listExpiredCandidates.mock.calls.map(([query]) => query.after)).toEqual([
    null,
    row('a'),
    row('b'),
    null,
  ]);
  expect(clock).toHaveBeenCalledTimes(2);
  expect(expire.mock.calls.map(([input]) => input)).toEqual([
    { bookingId: 'a' },
    { bookingId: 'b' },
    { bookingId: 'a' },
  ]);
});
test('fallo de lectura conserva corte y cursor sin fingir lista vacía', async () => {
  const error = new Error('database offline');
  const reader = {
    listExpiredCandidates: jest
      .fn()
      .mockResolvedValueOnce([row('a')])
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce([]),
  };
  const run = coordinate({
    reader,
    expireBooking: async () => ({ outcome: 'EXPIRED' }),
    clock: () => new Date(at),
    batchSize: 1,
  });
  await run();
  await expect(run()).rejects.toBe(error);
  await run();
  expect(reader.listExpiredCandidates.mock.calls[1]).toEqual(
    reader.listExpiredCandidates.mock.calls[2],
  );
});
test.each([
  null,
  [row('a'), row('a')],
  [{ bookingId: 'x', expiresAt: 'invalid' }],
  [{ bookingId: 'x', expiresAt: '2099-01-01T00:00:00.000Z' }],
])('rechaza datos inválidos del proveedor %j antes de expirar', async (rows) => {
  const expire = jest.fn();
  const run = coordinate({
    reader: { listExpiredCandidates: async () => rows },
    expireBooking: expire,
    clock: () => new Date(at),
    batchSize: 2,
  });
  await expect(run()).rejects.toMatchObject({ code: 'BOOKING_DATA_INTEGRITY_ERROR' });
  expect(expire).not.toHaveBeenCalled();
});
test('llamadas simultáneas comparten un lote y respetan resultados protegidos', async () => {
  const gate = deferred();
  const reader = { listExpiredCandidates: jest.fn(() => gate.promise) };
  const expire = jest
    .fn()
    .mockResolvedValueOnce({ outcome: 'PROOF_RECEIVED' })
    .mockResolvedValueOnce({ outcome: 'NOT_DUE' });
  const run = coordinate({
    reader,
    expireBooking: expire,
    clock: () => new Date(at),
    batchSize: 3,
  });
  const first = run();
  expect(run()).toBe(first);
  gate.resolve([row('a'), row('b')]);
  expect(await first).toEqual({
    scanned: 2,
    expired: 0,
    protected: 1,
    notDue: 1,
    failed: 0,
    continuing: false,
  });
  expect(reader.listExpiredCandidates).toHaveBeenCalledTimes(1);
});
test('el fallo seguro no expone SQL, identificadores ni mensajes internos', () => {
  expect(
    safeFailure({ code: '23505', message: 'SQL private passenger', bookingId: 'private' }, 'other'),
  ).toEqual({ code: 'BOOKING_LIFECYCLE_UNAVAILABLE', phase: 'batch' });
});
describe('ciclo de vida del trabajador automático', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  test('inicia de inmediato sin solaparse y espera el lote activo al detenerse', async () => {
    const gate = deferred();
    const runBatch = jest.fn(() => gate.promise);
    const running = worker({ runBatch, enabled: true, intervalMs: 100 });
    await jest.advanceTimersByTimeAsync(1000);
    expect(runBatch).toHaveBeenCalledTimes(1);
    let drained = false;
    const stopping = running.stop().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    gate.resolve();
    await stopping;
    await jest.advanceTimersByTimeAsync(1000);
    expect(runBatch).toHaveBeenCalledTimes(1);
  });
  test('reintenta tras fallar consulta y observador sin solaparse', async () => {
    const runBatch = jest.fn().mockRejectedValueOnce(new Error('read failed')).mockResolvedValue();
    const onError = jest.fn().mockRejectedValue(new Error('log failed'));
    const running = worker({ runBatch, enabled: true, intervalMs: 100, onError });
    await jest.advanceTimersByTimeAsync(0);
    expect(runBatch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(99);
    expect(runBatch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(runBatch).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
    await running.stop();
  });
  test('desactivar el trabajador evita intentos y temporizadores sin requerir stop', async () => {
    const runBatch = jest.fn();
    const running = worker({ runBatch, enabled: false, intervalMs: 100 });
    await jest.advanceTimersByTimeAsync(10000);
    expect(runBatch).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    await running.stop();
  });
  test.each([true, false])(
    'detener antes del primer ciclo evita trabajo (habilitado=%s)',
    async (enabled) => {
      const runBatch = jest.fn();
      const running = worker({ runBatch, enabled, intervalMs: 100 });
      await running.stop();
      await jest.advanceTimersByTimeAsync(1000);
      expect(runBatch).not.toHaveBeenCalled();
    },
  );
});
