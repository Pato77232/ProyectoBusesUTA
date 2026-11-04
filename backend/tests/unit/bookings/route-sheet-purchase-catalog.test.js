const snapshot = require('../../helpers/commercial-trip-snapshot');
const createTripQueries = require('../../../src/modules/route-sheets/application/create-trip-queries');
const catalogFactory = require('../../../src/modules/bookings/infrastructure/route-sheet-purchase-catalog');
const {
  readPurchaseTrip,
} = require('../../../src/modules/bookings/application/booking-purchase-context');
const calendarDateAt = require('../../../src/modules/bookings/infrastructure/booking-clock');
let source, provider, request, now;
beforeEach(() => {
  source = snapshot();
  now = '2030-01-01T06:00:00Z';
  source.inventory.snapshot.seats[0].category = 'VIP';
  request = { tripId: source.trip.id, fromPosition: 0, toPosition: 2 };
  provider = createTripQueries({
    tripRepository: { withSnapshot: async (_id, execute) => execute(source) },
    frequencyQueryPort: {
      findById: async () => ({
        id: source.trip.frequencyId,
        cooperativeId: source.trip.cooperativeId,
        status: 'ACTIVE',
      }),
    },
    busQueryPort: {
      findById: async () => ({
        id: source.trip.busId,
        cooperativeId: source.trip.cooperativeId,
        busGroupId: source.sheet.busGroupId,
      }),
    },
    now: () => now,
  });
});
test('precio explícito 450 no suma los tramos 200+300; VIP viene de copia congelada', async () => {
  const found = await catalogFactory({ tripQueries: provider }).findPurchaseContext(request);
  expect(found.amountCents).toBe(450);
  expect(found.seats[0].category).toBe('VIP');
  expect(found.inventorySnapshotId).toBe(source.trip.inventorySnapshotId);
  expect(Object.isFrozen(found.policy)).toBe(true);
  expect(Object.isFrozen(found.seats[0])).toBe(true);
});
test('mantiene los DTO anteriores sin categorías y calcula fecha local al embarcar tras medianoche', async () => {
  expect((await provider.findBookableForSegment(request)).seats).toBeUndefined();
  const trip = await readPurchaseTrip(
    { purchaseCatalog: catalogFactory({ tripQueries: provider }), calendarDateAt },
    { ...request, fromPosition: 1 },
  );
  expect(trip.departureDate).toBe('2030-01-02');
  expect(trip.boardingAt).toBe('2030-01-02T05:20:00.000Z');
});
test('una respuesta null no se sustituye por una tarifa histórica', async () => {
  const catalog = catalogFactory({ tripQueries: { findPurchaseContext: async () => null } });
  expect(await catalog.findPurchaseContext(request)).toBeNull();
});
test.each(['policy', 'amount', 'seats', 'identity'])(
  'rechaza DTO comercial corrupto: %s',
  async (field) => {
    const dto = await provider.findPurchaseContext(request);
    const changes = {
      policy: { policy: {} },
      amount: { amountCents: 0 },
      seats: { seats: [] },
      identity: { busId: 'incorrecto' },
    };
    const catalog = catalogFactory({
      tripQueries: { findPurchaseContext: async () => ({ ...dto, ...changes[field] }) },
    });
    await expect(catalog.findPurchaseContext(request)).rejects.toMatchObject({
      code: 'BOOKING_TRIP_DATA_INTEGRITY_ERROR',
    });
  },
);
test('propaga fallo técnico sin devolver ausencia ni inventario ficticio', async () => {
  const failure = new Error('fallo de prueba');
  const catalog = catalogFactory({
    tripQueries: {
      findPurchaseContext: async () => {
        throw failure;
      },
    },
  });
  await expect(catalog.findPurchaseContext(request)).rejects.toBe(failure);
});

test('revalida el embarque después de acreditar, sin aceptar un viaje que ya cerró', async () => {
  const getSummary = require('../../../src/modules/bookings/application/get-booking-summary.use-case');
  const seatId = source.inventory.snapshot.seats[0].seatId;
  const dependencies = {
    purchaseCatalog: catalogFactory({ tripQueries: provider }),
    calendarDateAt,
    clock: () => new Date('2030-01-01T06:00:00Z'),
    buyerIdentity: { resolve: async () => ({ ownerId: 'comprador-prueba' }) },
    passengerVerifier: {
      verify: async () => {
        now = '2030-01-02T07:00:00Z';
        return [{ seatId, birthDateVerified: true, disabilityVerified: false }];
      },
    },
  };
  await expect(
    getSummary(dependencies)(
      {
        ...request,
        seatIds: [seatId],
        passengers: [
          {
            seatId,
            identificationNumber: '0100000009',
            fullName: 'Persona de Prueba',
            birthDate: '1990-01-01',
          },
        ],
      },
      {},
    ),
  ).rejects.toMatchObject({ code: 'BOOKING_TRIP_UNAVAILABLE' });
});
