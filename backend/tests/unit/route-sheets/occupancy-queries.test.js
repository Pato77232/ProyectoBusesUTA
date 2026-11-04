const { randomUUID } = require('node:crypto');
const createBookingQueries = require('../../../src/modules/route-sheets/infrastructure/adapters/create-booking-queries');

const cooperativeId = randomUUID(),
  assignmentId = randomUUID(),
  routeSheetId = randomUUID(),
  busId = randomUUID();
let pool, occupancyQueries, queries;
beforeEach(() => {
  pool = {
    query: jest.fn().mockResolvedValue({ rows: [{ id: randomUUID() }, { id: randomUUID() }] }),
  };
  occupancyQueries = { hasActiveOccupations: jest.fn().mockResolvedValue(true) };
  queries = createBookingQueries({ pool, occupancyQueries });
});
test('resuelve viajes de la asignación dentro de su cooperativa', async () => {
  expect(await queries.hasPassengersForAssignment(assignmentId, cooperativeId)).toBe(true);
  expect(pool.query.mock.calls[0][1]).toEqual([cooperativeId, assignmentId]);
  const rows = (await pool.query.mock.results[0].value).rows;
  expect(occupancyQueries.hasActiveOccupations).toHaveBeenCalledWith({
    tripIds: rows.map((row) => row.id),
    cooperativeId,
  });
});
test('bus y hoja delimitan todos los viajes, sin recortar a uno', async () => {
  await queries.hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId);
  expect(pool.query.mock.calls[0][1]).toEqual([cooperativeId, routeSheetId, busId]);
  expect(occupancyQueries.hasActiveOccupations.mock.calls[0][0].tripIds).toHaveLength(2);
});
test('conserva false solo tras resolución correcta y consulta válida', async () => {
  pool.query.mockResolvedValue({ rows: [] });
  occupancyQueries.hasActiveOccupations.mockResolvedValue(false);
  expect(await queries.hasPassengersForAssignment(assignmentId, cooperativeId)).toBe(false);
  expect(occupancyQueries.hasActiveOccupations).toHaveBeenCalledWith({
    tripIds: [],
    cooperativeId,
  });
});
test('proveedor ausente falla cerrado antes de consultar', async () => {
  const missing = createBookingQueries({ pool });
  await expect(
    missing.hasPassengersForAssignment(assignmentId, cooperativeId),
  ).rejects.toMatchObject({ code: 'BOOKING_QUERIES_UNAVAILABLE', httpStatus: 503 });
  expect(pool.query).not.toHaveBeenCalled();
});
test('rechaza identidad inválida sin resolver viajes', async () => {
  await expect(queries.hasPassengersForAssignment('invalido', cooperativeId)).rejects.toThrow(
    TypeError,
  );
  expect(pool.query).not.toHaveBeenCalled();
});
test('no transforma fallo de resolución en ausencia de pasajeros', async () => {
  const failure = new Error('fallo de prueba');
  pool.query.mockRejectedValue(failure);
  await expect(queries.hasPassengersForAssignment(assignmentId, cooperativeId)).rejects.toBe(
    failure,
  );
  expect(occupancyQueries.hasActiveOccupations).not.toHaveBeenCalled();
});
test('propaga fallo de Reservas y rechaza respuestas no booleanas', async () => {
  const failure = new Error('fallo de prueba');
  occupancyQueries.hasActiveOccupations.mockRejectedValueOnce(failure).mockResolvedValueOnce(null);
  await expect(queries.hasPassengersForAssignment(assignmentId, cooperativeId)).rejects.toBe(
    failure,
  );
  await expect(queries.hasPassengersForAssignment(assignmentId, cooperativeId)).rejects.toThrow(
    TypeError,
  );
});
