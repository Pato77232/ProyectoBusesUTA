const { randomUUID } = require('node:crypto');
const catalog = require('../../../src/modules/bookings/infrastructure/route-sheet-availability-catalog');
const availability = require('../../../src/modules/bookings/application/get-seat-availability.use-case');
function fixture() {
  const tripId = randomUUID();
  const request = { tripId, fromPosition: 1, toPosition: 2 };
  const dto = {
    tripId,
    cooperativeId: randomUUID(),
    routeSheetId: randomUUID(),
    assignmentId: randomUUID(),
    requiredServiceId: randomUUID(),
    frequencyId: randomUUID(),
    busId: randomUUID(),
    inventorySnapshotId: randomUUID(),
    programmingRevision: 1,
    tariffRevision: 1,
    inventoryRevision: 1,
    routePointCount: 3,
    routePoints: [
      { position: 0, locationKey: 'A', departureAt: '2030-01-01T23:00:00-05:00' },
      {
        position: 1,
        locationKey: 'B',
        arrivalAt: '2030-01-02T00:00:00-05:00',
        departureAt: '2030-01-02T00:05:00-05:00',
      },
      { position: 2, locationKey: 'A', arrivalAt: '2030-01-02T01:00:00-05:00' },
    ],
    fromPosition: 1,
    toPosition: 2,
    boardingAt: '2030-01-02T00:05:00-05:00',
    confirmedThroughExclusive: '2030-01-03T05:00:00.000Z',
    seatIds: [randomUUID(), randomUUID()],
    amountCents: 450,
    currency: 'USD',
    policy: {},
  };
  const tripQueries = {
    findBookableForSegment: jest.fn(async () => dto),
    findBookableById: jest.fn(),
  };
  const allocationReader = { listEffectiveByTrip: jest.fn(async () => []) };
  const run = availability({ segmentCatalog: catalog({ tripQueries }), allocationReader });
  return { dto, request, tripQueries, allocationReader, run };
}
test('consulta el embarque elegido y deriva inventario/cooperativa sin exponer metadatos', async () => {
  const f = fixture();
  const result = await f.run(f.request);
  expect(f.tripQueries.findBookableForSegment).toHaveBeenCalledWith(f.request);
  expect(f.tripQueries.findBookableById).not.toHaveBeenCalled();
  expect(f.allocationReader.listEffectiveByTrip).toHaveBeenCalledWith({
    tripId: f.dto.tripId,
    cooperativeId: f.dto.cooperativeId,
  });
  expect(result).toEqual(f.dto.seatIds.map((seatId) => ({ seatId, status: 'AVAILABLE' })));
  expect(Object.isFrozen(result)).toBe(true);
});
test.each(['RESERVED', 'SOLD'])(
  'ocupación %s superpuesta bloquea y adyacente permite usar el mismo asiento',
  async (status) => {
    const f = fixture();
    f.allocationReader.listEffectiveByTrip.mockResolvedValue([
      {
        tripId: f.dto.tripId,
        cooperativeId: f.dto.cooperativeId,
        seatId: f.dto.seatIds[0],
        fromPosition: 0,
        toPosition: 2,
        status,
      },
      {
        tripId: f.dto.tripId,
        cooperativeId: f.dto.cooperativeId,
        seatId: f.dto.seatIds[1],
        fromPosition: 0,
        toPosition: 1,
        status,
      },
    ]);
    expect(await f.run(f.request)).toEqual([
      { seatId: f.dto.seatIds[0], status },
      { seatId: f.dto.seatIds[1], status: 'AVAILABLE' },
    ]);
  },
);
test.each([
  [
    'fecha inexistente',
    (d) => {
      d.routePoints[1].arrivalAt = '2030-02-31T00:00:00Z';
    },
  ],
  [
    'identidad',
    (d) => {
      d.tripId = randomUUID();
    },
  ],
  [
    'cooperativa',
    (d) => {
      d.cooperativeId = 'otra';
    },
  ],
  [
    'tramo',
    (d) => {
      d.fromPosition = 0;
    },
  ],
  [
    'recorrido',
    (d) => {
      d.routePoints[1].position = 2;
    },
  ],
  [
    'orden temporal',
    (d) => {
      d.routePoints[1].arrivalAt = '2029-01-01T00:00:00Z';
    },
  ],
  [
    'fecha sin zona',
    (d) => {
      d.routePoints[1].departureAt = '2030-01-02T00:05:00';
    },
  ],
  [
    'embarque',
    (d) => {
      d.boardingAt = d.routePoints[0].departureAt;
    },
  ],
  [
    'versión',
    (d) => {
      d.inventoryRevision = 0;
    },
  ],
  [
    'copia',
    (d) => {
      delete d.inventorySnapshotId;
    },
  ],
  [
    'asientos duplicados',
    (d) => {
      d.seatIds.push(d.seatIds[0]);
    },
  ],
  [
    'fuera de recorrido',
    (d) => {
      d.routePointCount = 2;
    },
  ],
])('rechaza snapshot con %s inválido antes de consultar ocupaciones', async (_label, mutate) => {
  const f = fixture();
  mutate(f.dto);
  await expect(f.run(f.request)).rejects.toMatchObject({
    code: 'BOOKING_TRIP_DATA_INTEGRITY_ERROR',
  });
  expect(f.allocationReader.listEffectiveByTrip).not.toHaveBeenCalled();
});
test.each([
  ['COMMERCIAL_TRIP_INVALID', 'BOOKING_VALIDATION_ERROR'],
  ['COMMERCIAL_TRIP_SOURCE_UNAVAILABLE', 'BOOKING_TRIP_SERVICE_UNAVAILABLE'],
])('propaga %s como %s sin fallback ni asientos libres', async (source, target) => {
  const f = fixture();
  f.tripQueries.findBookableForSegment.mockRejectedValue({ code: source });
  await expect(f.run(f.request)).rejects.toMatchObject({ code: target });
  expect(f.tripQueries.findBookableById).not.toHaveBeenCalled();
  expect(f.allocationReader.listEffectiveByTrip).not.toHaveBeenCalled();
});
test('errores desconocidos del catálogo y fallos de ocupación no se convierten en ausencia', async () => {
  const f = fixture();
  const error = new Error('SQL privado QA');
  f.tripQueries.findBookableForSegment.mockRejectedValueOnce(error);
  await expect(f.run(f.request)).rejects.toBe(error);
  f.allocationReader.listEffectiveByTrip.mockRejectedValue(error);
  await expect(f.run(f.request)).rejects.toBe(error);
});
test('viaje no comercializable no consulta ocupaciones ni devuelve todos libres', async () => {
  const f = fixture();
  f.tripQueries.findBookableForSegment.mockResolvedValue(null);
  await expect(f.run(f.request)).rejects.toMatchObject({ code: 'BOOKING_TRIP_UNAVAILABLE' });
  expect(f.allocationReader.listEffectiveByTrip).not.toHaveBeenCalled();
});
test('rechaza contexto del navegador antes de invocar el proveedor', async () => {
  const f = fixture();
  await expect(f.run({ ...f.request, cooperativeId: randomUUID() })).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
  });
  expect(f.tripQueries.findBookableForSegment).not.toHaveBeenCalled();
});
test('una lista explícita sin asientos ofrecidos conserva resultado vacío sin inventar inventario', async () => {
  const f = fixture();
  f.dto.seatIds = [];
  expect(await f.run(f.request)).toEqual([]);
});

test('captura inventario y cooperativa antes del await de ocupaciones', async () => {
  const f = fixture();
  const original = [...f.dto.seatIds];
  const cooperativeId = f.dto.cooperativeId;
  f.allocationReader.listEffectiveByTrip.mockImplementation(async (scope) => {
    expect(scope.cooperativeId).toBe(cooperativeId);
    f.dto.seatIds.splice(0, f.dto.seatIds.length, randomUUID());
    f.dto.cooperativeId = randomUUID();
    return [];
  });
  expect(await f.run(f.request)).toEqual(
    original.map((seatId) => ({ seatId, status: 'AVAILABLE' })),
  );
});
