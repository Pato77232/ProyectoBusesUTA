const { createBookingTicketQueries } = require('../../../src/modules/bookings');
const createQueries = require('../../../src/modules/bookings/application/create-booking-ticket-queries');
const { OWNER_ID, soldRowWithTrip } = require('../../helpers/sold-booking-ticket-trip');

const target = { bookingId: 'venta-opaca/qa', ownerId: OWNER_ID };

function harness(row = soldRowWithTrip()) {
  const pool = { query: jest.fn().mockResolvedValue({ rows: row === null ? [] : [row] }) };
  return { pool, query: createBookingTicketQueries({ pool }).findSoldForOwner };
}

test('el propietario recibe la venta con el tramo congelado, sin datos internos', async () => {
  const row = soldRowWithTrip();
  const h = harness(row);
  const value = await h.query(target);
  expect(value).toMatchObject({
    bookingId: target.bookingId,
    cooperativeId: 'coop-ticket',
    tripId: 'trip-ticket',
    fromPosition: 0,
    toPosition: 1,
    totalPriceCents: 1000,
  });
  expect(value.trip).toEqual({
    departureDate: '2026-11-10',
    origin: { position: 0, locationKey: 'Ambato', departureAt: '2026-11-10T08:00:00-05:00' },
    destination: { position: 1, locationKey: 'Latacunga', arrivalAt: '2026-11-10T08:50:00-05:00' },
  });
  expect(Object.isFrozen(value.trip)).toBe(true);
  expect(Object.isFrozen(value.trip.origin)).toBe(true);
  expect(JSON.stringify(value)).not.toMatch(/propietario-privado|birthDate|privateField/);
  row.summary.commercial.routePoints[0].locationKey = 'cambio posterior';
  expect(value.trip.origin.locationKey).toBe('Ambato');
});

test('la consulta filtra por reserva y propietario en una sola lectura sin escrituras', async () => {
  const h = harness();
  await h.query(target);
  const [sql, args] = h.pool.query.mock.calls[0];
  expect(args).toEqual([target.bookingId, OWNER_ID]);
  expect(sql).toContain('WHERE b.id=$1 AND b.owner_id=$2');
  expect(sql).not.toMatch(/UPDATE|DELETE|INSERT/);
  expect(h.pool.query).toHaveBeenCalledTimes(1);
});

test.each([
  null,
  undefined,
  {},
  [],
  { bookingId: 'venta-opaca/qa' },
  { ...target, cooperativeId: 'coop-ticket' },
  { ...target, ownerId: '  ' },
  { ...target, bookingId: 7 },
  Object.create(target),
])('consulta inválida %j no hace I/O', async (input) => {
  const h = harness();
  await expect(h.query(input)).rejects.toMatchObject({
    code: 'BOOKING_TICKET_QUERY_INVALID',
    httpStatus: 400,
  });
  expect(h.pool.query).not.toHaveBeenCalled();
});

test.each(['PENDING_PAYMENT', 'EXPIRED', 'REJECTED'])(
  'estado %s no habilita boleto aunque falte el tramo',
  async (status) => {
    const row = soldRowWithTrip();
    row.status = status;
    delete row.summary.commercial;
    expect(await harness(row).query(target)).toBeNull();
  },
);

test('reserva ausente o de otro propietario es null indistinguible', async () => {
  expect(await harness(null).query(target)).toBeNull();
  expect(await harness(null).query({ ...target, ownerId: 'otro' })).toBeNull();
});

const corruptions = [
  ['propietario distinto al pedido', (r) => (r.ownerId = 'otro')],
  ['reserva distinta a la pedida', (r) => (r.bookingId = 'otra')],
  ['sin fecha de servicio', (r) => delete r.summary.departureDate],
  ['fecha de servicio con hora', (r) => (r.summary.departureDate = '2026-11-10T00:00:00Z')],
  ['sin puntos del recorrido', (r) => delete r.summary.commercial.routePoints],
  ['recorrido más corto que el tramo', (r) => (r.summary.commercial.routePoints.length = 1)],
  ['posición desordenada', (r) => (r.summary.commercial.routePoints[1].position = 2)],
  ['origen sin nombre', (r) => (r.summary.commercial.routePoints[0].locationKey = ' ')],
  ['origen sin salida', (r) => delete r.summary.commercial.routePoints[0].departureAt],
  ['destino sin llegada', (r) => delete r.summary.commercial.routePoints[1].arrivalAt],
  [
    'hora sin zona',
    (r) => (r.summary.commercial.routePoints[0].departureAt = '2026-11-10T08:00:00'),
  ],
  [
    'llegada antes de la salida',
    (r) => (r.summary.commercial.routePoints[1].arrivalAt = '2026-11-10T07:00:00-05:00'),
  ],
  ['venta incoherente heredada', (r) => (r.totalPriceCents = '1001')],
];

test.each(corruptions)(
  'venta vendida con %s falla sin habilitar emisión',
  async (_label, corrupt) => {
    const row = soldRowWithTrip();
    corrupt(row);
    await expect(harness(row).query(target)).rejects.toMatchObject({
      code: 'BOOKING_TICKET_DATA_INTEGRITY_ERROR',
      httpStatus: 500,
    });
  },
);

test.each([
  ['ECONNRESET', 503],
  ['40001', 503],
  ['XX000', 500],
])('fallo %s se clasifica como %s sin filtrar el detalle', async (code, httpStatus) => {
  const h = harness();
  h.pool.query.mockRejectedValue(Object.assign(new Error('SQL y datos privados'), { code }));
  await expect(h.query(target)).rejects.toMatchObject({ httpStatus });
  await expect(h.query(target)).rejects.not.toThrow('SQL');
});

test('la fuente debe ofrecer ambas lecturas', () => {
  expect(() => createQueries({ reader: { findSoldCandidate: async () => null } })).toThrow(
    TypeError,
  );
});
