const { randomUUID } = require('node:crypto');
const factory = require('../../../../src/modules/route-sheets/application/create-trip-queries');
const fixture = require('../../../helpers/commercial-trip-snapshot');
let snapshot, frequency, bus, repository, queries, clock;
beforeEach(() => {
  snapshot = fixture();
  clock = '2030-01-01T12:00:00.000Z';
  repository = { withSnapshot: jest.fn(async (_id, run) => run(snapshot)) };
  frequency = {
    findById: jest.fn(async () => ({
      id: snapshot.trip.frequencyId,
      cooperativeId: snapshot.trip.cooperativeId,
      status: 'ACTIVE',
    })),
  };
  bus = {
    findById: jest.fn(async () => ({
      id: snapshot.trip.busId,
      cooperativeId: snapshot.trip.cooperativeId,
      busGroupId: snapshot.sheet.busGroupId,
    })),
  };
  queries = factory({
    tripRepository: repository,
    frequencyQueryPort: frequency,
    busQueryPort: bus,
    now: () => clock,
  });
});
const segment = () => ({ tripId: snapshot.trip.id, fromPosition: 0, toPosition: 2 });
test('borrador sin tarifa congelada no es comercializable', async () => {
  snapshot.sheet.status = 'DRAFT';
  snapshot.sheet.tariff = null;
  expect(await queries.findBookableById(snapshot.trip.id)).toBeNull();
  expect(frequency.findById).not.toHaveBeenCalled();
});
test('puerto ausente no se interpreta como viaje inexistente', async () => {
  const invalid = factory({ tripRepository: repository, busQueryPort: bus });
  await expect(invalid.findBookableById(snapshot.trip.id)).rejects.toMatchObject({
    code: 'COMMERCIAL_TRIP_SOURCE_UNAVAILABLE',
  });
});
test('conserva identidad, precio explícito, política congelada e inventario inmutable', async () => {
  const original = JSON.stringify(snapshot);
  const result = await queries.findBookableForSegment(segment());
  expect(result).toMatchObject({
    tripId: snapshot.trip.id,
    amountCents: 450,
    currency: 'USD',
    routePointCount: 3,
    confirmedThroughExclusive: snapshot.cycle.endExclusive,
    policy: { vipSurchargeBps: 2500 },
  });
  expect(result.seatIds).toEqual([snapshot.inventory.snapshot.seats[0].seatId]);
  for (const value of [
    result,
    result.seatIds,
    result.routePoints,
    result.routePoints[1],
    result.policy,
  ])
    expect(Object.isFrozen(value)).toBe(true);
  expect(JSON.stringify(snapshot)).toBe(original);
  expect(frequency.findById).toHaveBeenCalledWith(
    snapshot.trip.frequencyId,
    snapshot.trip.cooperativeId,
  );
  expect(bus.findById).toHaveBeenCalledWith(snapshot.trip.busId, snapshot.trip.cooperativeId);
});
test('salida del origen no cierra embarque posterior de medianoche', async () => {
  clock = snapshot.trip.departureAt;
  expect(await queries.findBookableForSegment(segment())).toBeNull();
  expect(await queries.findBookableById(snapshot.trip.id)).not.toBeNull();
  expect(await queries.findBookableForSegment({ ...segment(), fromPosition: 1 })).toMatchObject({
    amountCents: 300,
    boardingAt: '2030-01-02T05:20:00.000Z',
  });
  clock = '2030-01-02T05:20:00.000Z';
  expect(await queries.findBookableForSegment({ ...segment(), fromPosition: 1 })).toBeNull();
  expect(await queries.findBookableById(snapshot.trip.id)).toBeNull();
});
test.each([
  null,
  {},
  { tripId: 'bad', fromPosition: 0, toPosition: 2 },
  { fromPosition: 0, toPosition: 2 },
  { fromPosition: -1, toPosition: 1 },
  { fromPosition: 1, toPosition: 1 },
  { fromPosition: 0, toPosition: 1.5 },
])('rechaza entradas inválidas %j', async (input) => {
  await expect(queries.findBookableForSegment(input)).rejects.toMatchObject({
    code: 'COMMERCIAL_TRIP_INVALID',
  });
});
test.each(['cooperativeId', 'busId', 'seatIds', 'amountCents', 'now'])(
  'rechaza %s elegido por consumidor',
  async (field) => {
    await expect(
      queries.findBookableForSegment({ ...segment(), [field]: 'extra' }),
    ).rejects.toMatchObject({ code: 'COMMERCIAL_TRIP_INVALID' });
    expect(repository.withSnapshot).not.toHaveBeenCalled();
  },
);
test('rechaza posiciones fuera de recorrido', async () => {
  await expect(
    queries.findBookableForSegment({ ...segment(), toPosition: 3 }),
  ).rejects.toMatchObject({ code: 'COMMERCIAL_TRIP_INVALID' });
});
test('ausencia normal devuelve null', async () => {
  snapshot = null;
  expect(await queries.findBookableById(randomUUID())).toBeNull();
});
test('frecuencia inactiva no admite compra', async () => {
  frequency.findById.mockResolvedValue({ ...(await frequency.findById()), status: 'INACTIVE' });
  expect(await queries.findBookableForSegment(segment())).toBeNull();
});
test.each(['frequency', 'bus'])('ausencia de %s devuelve null', async (source) => {
  (source === 'bus' ? bus : frequency).findById.mockResolvedValue(null);
  expect(await queries.findBookableForSegment(segment())).toBeNull();
});
test.each(['frequency', 'bus'])('propaga fallo técnico de %s', async (source) => {
  const error = new Error('fuente caída');
  (source === 'bus' ? bus : frequency).findById.mockRejectedValue(error);
  await expect(queries.findBookableForSegment(segment())).rejects.toBe(error);
});
test('revalida reloj después de consultar proveedores', async () => {
  bus.findById.mockImplementation(async () => {
    clock = snapshot.trip.departureAt;
    return {
      id: snapshot.trip.busId,
      cooperativeId: snapshot.trip.cooperativeId,
      busGroupId: snapshot.sheet.busGroupId,
    };
  });
  expect(await queries.findBookableForSegment(segment())).toBeNull();
});
test.each(['tariff', 'inventory', 'revision', 'tenant', 'points', 'series'])(
  'rechaza corrupción de %s sin fallback',
  async (kind) => {
    if (kind === 'tariff') snapshot.sheet.tariff.frequencies[0].prices.pop();
    if (kind === 'inventory') snapshot.inventory.snapshot.seats[0].offered = false;
    if (kind === 'revision') snapshot.trip.tariffRevision = 2;
    if (kind === 'tenant') snapshot.sheet.cooperativeId = randomUUID();
    if (kind === 'points') snapshot.trip.routePoints[1].departureAt = '2030-01-01T00:00:00Z';
    if (kind === 'series') snapshot.cycles[0].cycleNumber = 2;
    await expect(queries.findBookableForSegment(segment())).rejects.toMatchObject({
      code: 'COMMERCIAL_TRIP_SOURCE_UNAVAILABLE',
    });
  },
);
