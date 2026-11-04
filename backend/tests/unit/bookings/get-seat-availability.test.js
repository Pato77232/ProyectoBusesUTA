const getSeatAvailability = require('../../../src/modules/bookings/application/get-seat-availability.use-case');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');
const BookingTripUnavailableError = require('../../../src/modules/bookings/domain/booking-trip-unavailable-error');

const request = Object.freeze({ tripId: 'viaje-1', fromPosition: 1, toPosition: 3 });
const trip = Object.freeze({
  tripId: 'viaje-1',
  cooperativeId: 'cooperativa-1',
  routePointCount: 5,
  seatIds: Object.freeze(['02', '01']),
});
const allocation = Object.freeze({
  ...request,
  cooperativeId: trip.cooperativeId,
  seatId: '01',
  status: 'RESERVED',
});

function setup(snapshot = trip, allocations = []) {
  const tripCatalog = { findBookableById: jest.fn().mockResolvedValue(snapshot) };
  const allocationReader = { listEffectiveByTrip: jest.fn().mockResolvedValue(allocations) };
  return {
    tripCatalog,
    allocationReader,
    execute: getSeatAvailability({ tripCatalog, allocationReader }),
  };
}

test('consulta el catálogo antes de leer ocupaciones con la cooperativa real', async () => {
  const { execute, tripCatalog, allocationReader } = setup();
  expect(await execute(request)).toEqual([
    { seatId: '02', status: 'AVAILABLE' },
    { seatId: '01', status: 'AVAILABLE' },
  ]);
  expect(tripCatalog.findBookableById).toHaveBeenCalledTimes(1);
  expect(tripCatalog.findBookableById).toHaveBeenCalledWith('viaje-1');
  expect(allocationReader.listEffectiveByTrip).toHaveBeenCalledTimes(1);
  expect(allocationReader.listEffectiveByTrip).toHaveBeenCalledWith({
    tripId: 'viaje-1',
    cooperativeId: 'cooperativa-1',
  });
  expect(tripCatalog.findBookableById.mock.invocationCallOrder[0]).toBeLessThan(
    allocationReader.listEffectiveByTrip.mock.invocationCallOrder[0],
  );
});

test('normaliza el identificador antes de consultar el catálogo', async () => {
  const { execute, tripCatalog } = setup();
  await execute({ ...request, tripId: ' viaje-1 ' });
  expect(tripCatalog.findBookableById).toHaveBeenCalledWith('viaje-1');
});

test.each(
  [
    undefined,
    null,
    [],
    {},
    { ...request, tripId: '' },
    { ...request, tripId: '   ' },
    { ...request, tripId: 1 },
    { ...request, fromPosition: -1 },
    { ...request, fromPosition: 1.5 },
    { ...request, fromPosition: '1' },
    { ...request, toPosition: 1 },
    { ...request, toPosition: Infinity },
    { ...request, toPosition: Number.MAX_SAFE_INTEGER + 1 },
    { ...request, cooperativeId: 'cooperativa-ajena' },
    { ...request, seatIds: ['asiento-inventado'] },
    { ...request, allocations: [] },
  ].map((value) => [value]),
)('rechaza entrada inválida sin consultar proveedores: %j', async (input) => {
  const { execute, tripCatalog, allocationReader } = setup();
  await expect(execute(input)).rejects.toBeInstanceOf(BookingValidationError);
  expect(tripCatalog.findBookableById).not.toHaveBeenCalled();
  expect(allocationReader.listEffectiveByTrip).not.toHaveBeenCalled();
});

test('viaje ausente o no comercializable produce el mismo error sin consultar ocupaciones', async () => {
  const { execute, allocationReader } = setup(null);
  await expect(execute(request)).rejects.toMatchObject({
    name: 'BookingTripUnavailableError',
    code: 'BOOKING_TRIP_UNAVAILABLE',
  });
  await expect(execute(request)).rejects.toBeInstanceOf(BookingTripUnavailableError);
  expect(allocationReader.listEffectiveByTrip).not.toHaveBeenCalled();
});

test.each(
  [
    undefined,
    {},
    [],
    { ...trip, tripId: 'otro-viaje' },
    { ...trip, cooperativeId: '' },
    { ...trip, cooperativeId: 1 },
    { ...trip, routePointCount: 1 },
    { ...trip, routePointCount: 4.5 },
    { ...trip, routePointCount: Infinity },
    { ...trip, seatIds: null },
    { ...trip, seatIds: ['01', '01'] },
    { ...trip, seatIds: [''] },
    { ...trip, seatIds: [1] },
    { ...trip, seatIds: Array(1) },
  ].map((value) => [value]),
)('rechaza un catálogo incoherente antes de leer ocupaciones: %j', async (snapshot) => {
  const { execute, tripCatalog, allocationReader } = setup();
  tripCatalog.findBookableById.mockResolvedValue(snapshot);
  await expect(execute(request)).rejects.toBeInstanceOf(BookingValidationError);
  expect(allocationReader.listEffectiveByTrip).not.toHaveBeenCalled();
});

test.each([5, 6])(
  'rechaza destino %i fuera del recorrido antes de leer ocupaciones',
  async (toPosition) => {
    const { execute, allocationReader } = setup();
    await expect(execute({ ...request, toPosition })).rejects.toBeInstanceOf(
      BookingValidationError,
    );
    expect(allocationReader.listEffectiveByTrip).not.toHaveBeenCalled();
  },
);

test('acepta los extremos reales de una ruta de dos puntos', async () => {
  const { execute } = setup({ ...trip, routePointCount: 2 });
  expect(await execute({ ...request, fromPosition: 0, toPosition: 1 })).toHaveLength(2);
});

test.each(['RESERVED', 'SOLD'])(
  'respeta el bloqueo %s y no expone datos personales',
  async (status) => {
    const sensitiveAllocation = Object.freeze({
      ...allocation,
      status,
      ownerId: 'propietario-privado',
      identificationNumber: 'privado',
      proofPath: 'archivo-privado',
    });
    const { execute } = setup({ ...trip, internalData: 'privado' }, [sensitiveAllocation]);
    expect(await execute(request)).toEqual([
      { seatId: '02', status: 'AVAILABLE' },
      { seatId: '01', status },
    ]);
  },
);

test.each([
  { fromPosition: 0, toPosition: 1 },
  { fromPosition: 3, toPosition: 4 },
  { tripId: 'otro-viaje' },
  { cooperativeId: 'otra-cooperativa' },
  { seatId: 'otro-asiento' },
])('no bloquea un tramo adyacente ni devuelve ocupaciones ajenas: %j', async (change) => {
  const { execute } = setup(trip, [{ ...allocation, ...change }]);
  expect((await execute(request)).every((seat) => seat.status === 'AVAILABLE')).toBe(true);
});

test('vendido predomina, el resultado es inmutable y las entradas permanecen intactas', async () => {
  const allocations = Object.freeze([Object.freeze({ ...allocation, status: 'SOLD' }), allocation]);
  const { execute, allocationReader } = setup(trip, allocations);
  const result = await execute(request);
  expect(result[1]).toEqual({ seatId: '01', status: 'SOLD' });
  expect(Object.isFrozen(result)).toBe(true);
  expect(result.every(Object.isFrozen)).toBe(true);
  expect(trip.seatIds).toEqual(['02', '01']);
  expect(allocations).toHaveLength(2);
  expect(request).toEqual({ tripId: 'viaje-1', fromPosition: 1, toPosition: 3 });
  expect(Object.isFrozen(allocationReader.listEffectiveByTrip.mock.calls[0][0])).toBe(true);
});

test('protege la copia de consulta e inventario durante las lecturas asíncronas', async () => {
  const input = { ...request };
  const mutableTrip = { ...trip, seatIds: [...trip.seatIds] };
  const { execute, tripCatalog, allocationReader } = setup(mutableTrip);
  tripCatalog.findBookableById.mockImplementation(async () => {
    input.toPosition = 99;
    input.tripId = 'otro-viaje';
    return mutableTrip;
  });
  allocationReader.listEffectiveByTrip.mockImplementation(async () => {
    mutableTrip.seatIds.push('asiento-tardío');
    mutableTrip.cooperativeId = 'otra-cooperativa';
    return [];
  });
  expect(await execute(input)).toEqual([
    { seatId: '02', status: 'AVAILABLE' },
    { seatId: '01', status: 'AVAILABLE' },
  ]);
  expect(allocationReader.listEffectiveByTrip).toHaveBeenCalledWith({
    tripId: 'viaje-1',
    cooperativeId: 'cooperativa-1',
  });
});

test.each(
  [undefined, null, {}, [null], [{ ...allocation, status: 'EXPIRED' }]].map((value) => [value]),
)('no convierte una fuente inválida en asientos disponibles: %j', async (allocations) => {
  const { execute, allocationReader } = setup();
  allocationReader.listEffectiveByTrip.mockResolvedValue(allocations);
  await expect(execute(request)).rejects.toBeInstanceOf(BookingValidationError);
});

test('acepta un inventario explícitamente vacío sin inventar asientos', async () => {
  const { execute } = setup({ ...trip, seatIds: [] });
  expect(await execute(request)).toEqual([]);
});

test.each(['catalog', 'allocations'])(
  'propaga fallos de %s sin ofrecer disponibilidad ficticia',
  async (source) => {
    const failure = new Error('Proveedor no disponible');
    const { execute, tripCatalog, allocationReader } = setup();
    if (source === 'catalog') tripCatalog.findBookableById.mockRejectedValue(failure);
    else allocationReader.listEffectiveByTrip.mockRejectedValue(failure);
    await expect(execute(request)).rejects.toBe(failure);
    if (source === 'catalog') expect(allocationReader.listEffectiveByTrip).not.toHaveBeenCalled();
  },
);
