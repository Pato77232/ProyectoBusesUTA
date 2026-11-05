const { createSeatMap } = require('../../../src/modules/bookings/domain/seat-map');
const getSeatMap = require('../../../src/modules/bookings/application/get-seat-map.use-case');
const routeSheetSeatMapCatalog = require('../../../src/modules/bookings/infrastructure/route-sheet-seat-map-catalog');

const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const request = Object.freeze({ tripId: ID(1), fromPosition: 0, toPosition: 1 });
const seat = (n, extra = {}) => ({
  seatId: ID(100 + n),
  layoutSeatKey: `k-${n}`,
  label: n,
  deck: 1,
  row: Math.floor((n - 1) / 4),
  column: (n - 1) % 4,
  category: 'NORMAL',
  offered: true,
  ...extra,
});
const at = (hour) => `2026-11-12T${hour}:00.000Z`;
function source(seats = [seat(2), seat(1, { deck: 2 }), seat(3, { category: 'VIP' })]) {
  return {
    ...request,
    cooperativeId: ID(2),
    routeSheetId: ID(3),
    assignmentId: ID(4),
    requiredServiceId: ID(5),
    frequencyId: ID(6),
    busId: ID(7),
    inventorySnapshotId: ID(8),
    programmingRevision: 1,
    tariffRevision: 1,
    inventoryRevision: 1,
    routePointCount: 2,
    routePoints: [
      { position: 0, locationKey: 'AMBATO', departureAt: at('13:30') },
      { position: 1, locationKey: 'QUITO', arrivalAt: at('16:00') },
    ],
    boardingAt: at('13:30'),
    confirmedThroughExclusive: at('20:00'),
    seatIds: seats.map((value) => value.seatId),
    seats,
  };
}
const catalogFor = (value) =>
  routeSheetSeatMapCatalog({ tripQueries: { findPurchaseContext: jest.fn(async () => value) } });

test('ordena por piso descendente y número, sin datos internos de la plantilla', () => {
  const value = source();
  expect(createSeatMap({ seats: value.seats, seatIds: value.seatIds })).toEqual([
    { seatId: ID(101), label: 1, deck: 2, row: 0, column: 0, category: 'NORMAL' },
    { seatId: ID(102), label: 2, deck: 1, row: 0, column: 1, category: 'NORMAL' },
    { seatId: ID(103), label: 3, deck: 1, row: 0, column: 2, category: 'VIP' },
  ]);
});

test.each([
  ['etiqueta repetida', [seat(1), seat(1, { seatId: ID(150) })]],
  ['piso inexistente', [seat(1, { deck: 3 })]],
  ['categoría no ofertable', [seat(1, { category: 'ACCESSIBLE' })]],
  ['asiento no ofrecido', [seat(1, { offered: false })]],
  ['fila negativa', [seat(1, { row: -1 })]],
  ['etiqueta cero', [seat(1, { label: 0 })]],
])('rechaza la distribución completa ante %s', (_, seats) => {
  expect(() => createSeatMap({ seats, seatIds: seats.map((value) => value.seatId) })).toThrow(
    expect.objectContaining({ code: 'BOOKING_TRIP_DATA_INTEGRITY_ERROR' }),
  );
});

test('rechaza asientos que no coinciden con el inventario de disponibilidad', () => {
  expect(() => createSeatMap({ seats: [seat(1)], seatIds: [ID(999)] })).toThrow(
    expect.objectContaining({ code: 'BOOKING_TRIP_DATA_INTEGRITY_ERROR' }),
  );
  expect(() => createSeatMap({ seats: [seat(1)], seatIds: [ID(101), ID(102)] })).toThrow(
    expect.objectContaining({ code: 'BOOKING_TRIP_DATA_INTEGRITY_ERROR' }),
  );
});

test('el adaptador lee la copia publicada y devuelve la distribución', async () => {
  const findPurchaseContext = jest.fn(async () => source());
  const catalog = routeSheetSeatMapCatalog({ tripQueries: { findPurchaseContext } });
  const seats = await catalog.findSeatMap(request);
  expect(findPurchaseContext).toHaveBeenCalledWith(request);
  expect(seats.map((value) => value.label)).toEqual([1, 2, 3]);
});

test('el adaptador traduce errores de la fuente y conserva la ausencia', async () => {
  expect(await catalogFor(null).findSeatMap(request)).toBeNull();
  const failing = (code) =>
    routeSheetSeatMapCatalog({
      tripQueries: { findPurchaseContext: jest.fn().mockRejectedValue({ code }) },
    }).findSeatMap(request);
  await expect(failing('COMMERCIAL_TRIP_INVALID')).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
  });
  await expect(failing('COMMERCIAL_TRIP_SOURCE_UNAVAILABLE')).rejects.toMatchObject({
    code: 'BOOKING_TRIP_SERVICE_UNAVAILABLE',
  });
  await expect(
    catalogFor({ ...source(), tripId: ID(77) }).findSeatMap(request),
  ).rejects.toMatchObject({ code: 'BOOKING_TRIP_DATA_INTEGRITY_ERROR' });
});

test('el adaptador exige el contrato de compra de Route Sheets', () => {
  expect(() => routeSheetSeatMapCatalog({ tripQueries: {} })).toThrow(TypeError);
});

test('el caso de uso valida la consulta antes de leer y distingue viaje ausente', async () => {
  const seatMapCatalog = { findSeatMap: jest.fn(async () => null) };
  const execute = getSeatMap({ seatMapCatalog });
  await expect(execute({ ...request, cooperativeId: ID(9) })).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
  });
  expect(seatMapCatalog.findSeatMap).not.toHaveBeenCalled();
  await expect(execute(request)).rejects.toMatchObject({ code: 'BOOKING_TRIP_UNAVAILABLE' });
  await expect(getSeatMap({})(request)).rejects.toMatchObject({
    code: 'BOOKING_TRIP_SERVICE_UNAVAILABLE',
  });
});
