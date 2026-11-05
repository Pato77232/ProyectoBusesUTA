const { createHash } = require('node:crypto');
const factory = require('../../../src/modules/bookings/application/benefit-requests');
const ids = {
  owner: '10000000-0000-4000-8000-000000000001',
  other: '10000000-0000-4000-8000-000000000002',
  clerk: '20000000-0000-4000-8000-000000000001',
  coop: '30000000-0000-4000-8000-000000000001',
  foreign: '30000000-0000-4000-8000-000000000002',
  trip: '40000000-0000-4000-8000-000000000001',
  request: '50000000-0000-4000-8000-000000000001',
};
const customer = {
  sid: 'session-qa',
  user: { id: ids.owner, role: 'CUSTOMER', cooperative_id: null },
};
const clerk = {
  sid: 'session-qa',
  user: { id: ids.clerk, role: 'CLERK', cooperative_id: ids.coop },
};
const input = () => ({
  tripId: ids.trip,
  fromPosition: 0,
  toPosition: 1,
  requestKey: 'benefit-request-0001',
  seatIds: ['seat-1', 'seat-2'],
  passengers: ['seat-1', 'seat-2'].map((seatId) => ({
    seatId,
    fullName: 'Persona QA',
    identificationNumber: '0100000009',
    birthDate: '1990-01-01',
  })),
});
function harness() {
  let row = null;
  let now = new Date('2026-11-04T14:00:00Z');
  const repository = {
    findByKey: jest.fn(async () => row),
    save: jest.fn(async (value) => {
      row = {
        ...value,
        tripId: value.purchase.tripId,
        fromPosition: value.purchase.fromPosition,
        toPosition: value.purchase.toPosition,
        passengerCount: value.purchase.passengers.length,
        status: 'PENDING',
        revision: 1,
      };
      return { row, created: true };
    }),
    get: jest.fn(async () => row),
    list: jest.fn(async () => ({ rows: row ? [row] : [], nextCursor: null })),
  };
  const trip = {
    tripId: ids.trip,
    cooperativeId: ids.coop,
    fromPosition: 0,
    toPosition: 1,
    boardingAt: '2030-01-01T12:00:00.000Z',
    seats: [{ seatId: 'seat-1' }, { seatId: 'seat-2' }],
    routePoints: [
      { position: 0, locationKey: 'Ambato' },
      { position: 1, locationKey: 'Quito' },
    ],
  };
  const purchaseCatalog = { findPurchaseContext: jest.fn(async () => trip) };
  const api = factory({
    repository,
    purchaseCatalog,
    clock: () => now,
    calendarDateAt: (date) => date.toISOString().slice(0, 10),
    newId: () => ids.request,
    fingerprint: (value) => createHash('sha256').update(value).digest('hex'),
  });
  return {
    api,
    repository,
    purchaseCatalog,
    trip,
    row: () => row,
    now: (date) => {
      now = date;
    },
  };
}
test('crea contexto privado persistido con propietario verificado y respuesta sin PII', async () => {
  const h = harness();
  const result = await h.api.create(input(), customer);
  expect(result.created).toBe(true);
  expect(result.request).toMatchObject({
    requestId: ids.request,
    status: 'PENDING',
    revision: 1,
    passengerCount: 2,
    fromPlace: 'Ambato',
    toPlace: 'Quito',
    expiresAt: h.trip.boardingAt,
  });
  expect(JSON.stringify(result)).not.toMatch(
    /0100000009|Persona QA|ownerId|passengers|fingerprint/,
  );
  expect(h.row().ownerId).toBe(ids.owner);
  expect(h.row().cooperativeId).toBe(ids.coop);
  expect(Object.isFrozen(result.request)).toBe(true);
});
test('orden equivalente recupera el mismo intento sin catálogo ni ampliar plazo', async () => {
  const h = harness();
  const created = await h.api.create(input(), customer);
  const again = input();
  again.seatIds.reverse();
  again.passengers.reverse();
  h.purchaseCatalog.findPurchaseContext.mockRejectedValue(new Error('ya no disponible'));
  h.now(new Date(h.trip.boardingAt));
  const recovered = await h.api.create(again, customer);
  expect(recovered.created).toBe(false);
  expect(recovered.request).toMatchObject({
    ...created.request,
    status: 'EXPIRED',
    evaluatedAt: h.trip.boardingAt,
  });
  expect(h.repository.save).toHaveBeenCalledTimes(1);
  expect(h.purchaseCatalog.findPurchaseContext).toHaveBeenCalledTimes(1);
});
test('misma clave y otros datos se rechaza antes de consultar catálogo', async () => {
  const h = harness();
  await h.api.create(input(), customer);
  const changed = input();
  changed.passengers[0].fullName = 'Otra Persona';
  await expect(h.api.create(changed, customer)).rejects.toMatchObject({
    code: 'BOOKING_BENEFIT_REQUEST_KEY_REUSED',
    httpStatus: 409,
  });
  expect(h.repository.save).toHaveBeenCalledTimes(1);
});
test.each([
  undefined,
  null,
  {},
  [],
  { ...input(), ownerId: ids.other },
  { ...input(), cooperativeId: ids.foreign },
  { ...input(), requestKey: 'corta' },
  { ...input(), seatIds: ['seat-1'] },
  { ...input(), tripId: 'no-uuid' },
])('entrada inválida %j no consulta repositorio', async (value) => {
  const h = harness();
  await expect(h.api.create(value, customer)).rejects.toMatchObject({ httpStatus: 400 });
  expect(h.repository.findByKey).not.toHaveBeenCalled();
  expect(h.repository.save).not.toHaveBeenCalled();
});
test.each([
  null,
  {},
  { user: customer.user },
  { ...clerk, user: { ...clerk.user, role: 'COOPERATIVE_ADMIN' } },
  clerk,
])('sin identidad cliente autorizada no inicia solicitud %j', async (actor) => {
  const h = harness();
  await expect(h.api.create(input(), actor)).rejects.toMatchObject({
    httpStatus: actor?.sid ? 403 : 401,
  });
  expect(h.repository.findByKey).not.toHaveBeenCalled();
});
test('detalle de cliente no revela manifiesto; CLERK propio recibe copia congelada', async () => {
  const h = harness();
  await h.api.create(input(), customer);
  const own = await h.api.get(ids.request, customer);
  expect(own).not.toHaveProperty('passengers');
  const detail = await h.api.get(ids.request, clerk);
  expect(detail.passengers).toHaveLength(2);
  expect(Object.isFrozen(detail.passengers)).toBe(true);
  expect(detail.passengers.every(Object.isFrozen)).toBe(true);
  h.row().purchase.passengers = [];
  expect(detail.passengers).toHaveLength(2);
});
test('ausencia y scope ajeno son el mismo 404', async () => {
  const h = harness();
  await expect(h.api.get(ids.request, customer)).rejects.toMatchObject({
    code: 'BOOKING_BENEFIT_REQUEST_NOT_FOUND',
  });
  await h.api.create(input(), customer);
  await expect(
    h.api.get(ids.request, { ...customer, user: { ...customer.user, id: ids.other } }),
  ).rejects.toMatchObject({ code: 'BOOKING_BENEFIT_REQUEST_NOT_FOUND' });
  await expect(
    h.api.get(ids.request, { ...clerk, user: { ...clerk.user, cooperative_id: ids.foreign } }),
  ).rejects.toMatchObject({ code: 'BOOKING_BENEFIT_REQUEST_NOT_FOUND' });
});
test('bandeja privada sin pasajeros y sin acceso implícito para CUSTOMER', async () => {
  const h = harness();
  await h.api.create(input(), customer);
  const result = await h.api.list({}, clerk);
  expect(result.requests).toHaveLength(1);
  expect(JSON.stringify(result)).not.toMatch(/0100000009|Persona QA|ownerId/);
  expect(h.repository.list).toHaveBeenCalledWith({
    cooperativeId: ids.coop,
    limit: 20,
    cursor: null,
  });
  await expect(h.api.list({}, customer)).rejects.toMatchObject({ httpStatus: 403 });
});
test.each([
  { limit: '0' },
  { limit: '101' },
  { limit: '1.2' },
  { limit: ['20'] },
  { cursor: 'bad' },
  { cooperativeId: ids.foreign },
  { ownerId: ids.other },
])('query de bandeja inválida %j no consulta datos', async (query) => {
  const h = harness();
  await expect(h.api.list(query, clerk)).rejects.toMatchObject({ httpStatus: 400 });
  expect(h.repository.list).not.toHaveBeenCalled();
});
test.each([
  ['ECONNRESET', 503],
  ['XX000', 500],
])('error %s no produce bandeja vacía', async (code, httpStatus) => {
  const h = harness();
  h.repository.list.mockRejectedValue(Object.assign(new Error('SELECT privado'), { code }));
  await expect(h.api.list({}, clerk)).rejects.toMatchObject({ httpStatus });
  await expect(h.api.list({}, clerk)).rejects.not.toThrow('SELECT');
});
test('viaje ausente, embarque cerrado y asiento ajeno no guardan solicitud', async () => {
  const h = harness();
  h.purchaseCatalog.findPurchaseContext.mockResolvedValueOnce(null);
  await expect(h.api.create(input(), customer)).rejects.toMatchObject({
    code: 'BOOKING_TRIP_UNAVAILABLE',
  });
  h.trip.boardingAt = '2026-11-04T14:00:00.000Z';
  await expect(h.api.create(input(), customer)).rejects.toMatchObject({
    code: 'BOOKING_TRIP_UNAVAILABLE',
  });
  h.trip.boardingAt = '2030-01-01T12:00:00.000Z';
  h.trip.seats = [];
  await expect(h.api.create(input(), customer)).rejects.toMatchObject({ httpStatus: 400 });
  expect(h.repository.save).not.toHaveBeenCalled();
});
test('catálogo caído no guarda y dato persistido incoherente no da éxito', async () => {
  const h = harness();
  h.purchaseCatalog.findPurchaseContext.mockRejectedValueOnce(
    Object.assign(new Error('interno'), { code: 'ECONNRESET' }),
  );
  await expect(h.api.create(input(), customer)).rejects.toMatchObject({ httpStatus: 503 });
  expect(h.repository.save).not.toHaveBeenCalled();
  await h.api.create(input(), customer);
  h.row().revision = 99;
  await expect(h.api.get(ids.request, customer)).rejects.toMatchObject({ httpStatus: 500 });
});
