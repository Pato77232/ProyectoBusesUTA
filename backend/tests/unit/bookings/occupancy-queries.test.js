const { randomUUID } = require('node:crypto');
const { createBookingOccupancyQueries } = require('../../../src/modules/bookings');

const cooperativeId = randomUUID();
const tripId = randomUUID();
let pool, queries;
beforeEach(() => {
  pool = { query: jest.fn().mockResolvedValue({ rows: [{ occupied: true }] }) };
  queries = createBookingOccupancyQueries({ pool });
});

test.each([true, false])('devuelve el booleano estricto del proveedor: %s', async (occupied) => {
  pool.query.mockResolvedValue({ rows: [{ occupied }] });
  expect(await queries.hasActiveOccupations({ tripIds: [tripId], cooperativeId })).toBe(occupied);
  expect(pool.query.mock.calls[0][1]).toEqual([cooperativeId, [tripId]]);
});
test('una lista vacía válida no necesita consultar ocupaciones', async () => {
  expect(await queries.hasActiveOccupations({ tripIds: [], cooperativeId })).toBe(false);
  expect(pool.query).not.toHaveBeenCalled();
});
test.each([
  undefined,
  {},
  { tripIds: [] },
  { tripIds: ['invalido'], cooperativeId },
  { tripIds: [tripId], cooperativeId: 'ajena' },
  { tripIds: 'lista', cooperativeId },
])('rechaza entrada inválida sin ejecutar SQL: %j', async (input) => {
  await expect(queries.hasActiveOccupations(input)).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
  });
  expect(pool.query).not.toHaveBeenCalled();
});
test('no oculta fallos de persistencia ni respuestas incompletas', async () => {
  const failure = new Error('fallo de prueba');
  pool.query.mockRejectedValueOnce(failure);
  await expect(queries.hasActiveOccupations({ tripIds: [tripId], cooperativeId })).rejects.toBe(
    failure,
  );
  pool.query.mockResolvedValue({ rows: [] });
  await expect(queries.hasActiveOccupations({ tripIds: [tripId], cooperativeId })).rejects.toThrow(
    TypeError,
  );
});
