const { createBookingNotificationQueries } = require('../../../src/modules/bookings');
const { OWNER_ID, soldRowWithTrip } = require('../../helpers/sold-booking-ticket-trip');

const target = { bookingId: 'venta-opaca/qa', cooperativeId: 'coop-ticket' };

function row(status = 'SOLD') {
  const sold = soldRowWithTrip();
  return {
    bookingId: sold.bookingId,
    cooperativeId: sold.cooperativeId,
    ownerId: OWNER_ID,
    status,
    fromPosition: sold.fromPosition,
    toPosition: sold.toPosition,
    totalPriceCents: sold.totalPriceCents,
    summary: sold.summary,
  };
}

function harness(value = row()) {
  const pool = { query: jest.fn().mockResolvedValue({ rows: value === null ? [] : [value] }) };
  return { pool, find: createBookingNotificationQueries({ pool }).findNotificationContext };
}

test('entrega propietario, estado, tramo y nombres, sin cédulas', async () => {
  const h = harness();
  const context = await h.find(target);
  expect(context).toEqual({
    ...target,
    ownerId: OWNER_ID,
    status: 'SOLD',
    currency: 'USD',
    totalPriceCents: 1000,
    trip: {
      departureDate: '2026-11-10',
      origin: { position: 0, locationKey: 'Ambato', departureAt: '2026-11-10T08:00:00-05:00' },
      destination: {
        position: 1,
        locationKey: 'Latacunga',
        arrivalAt: '2026-11-10T08:50:00-05:00',
      },
    },
    passengers: [{ fullName: 'Pasajera QA Uno' }, { fullName: 'Pasajero QA Dos' }],
  });
  expect(JSON.stringify(context)).not.toMatch(/1710034065|birthDate|privateField/);
  expect(Object.isFrozen(context.passengers[0])).toBe(true);
  const [sql, args] = h.pool.query.mock.calls[0];
  expect(args).toEqual([target.bookingId, target.cooperativeId]);
  expect(sql).toContain('WHERE id=$1 AND cooperative_id=$2');
});

test.each(['PENDING_PAYMENT', 'EXPIRED', 'REJECTED'])('también lee reservas %s', async (status) => {
  expect((await harness(row(status)).find(target)).status).toBe(status);
});

test('sin tramo congelado devuelve trip null en lugar de fallar', async () => {
  const value = row('EXPIRED');
  delete value.summary.commercial;
  expect((await harness(value).find(target)).trip).toBeNull();
  value.summary.schemaVersion = 1;
  expect((await harness(value).find(target)).trip).toBeNull();
});

test('reserva ausente o de otra cooperativa es null', async () => {
  expect(await harness(null).find(target)).toBeNull();
});

test.each([
  null,
  {},
  { bookingId: 'b' },
  { ...target, ownerId: 'x' },
  { ...target, bookingId: ' ' },
  { ...target, cooperativeId: 'x'.repeat(201) },
])('consulta inválida %j no hace I/O', async (input) => {
  const h = harness();
  await expect(h.find(input)).rejects.toMatchObject({
    code: 'BOOKING_NOTIFICATION_QUERY_INVALID',
  });
  expect(h.pool.query).not.toHaveBeenCalled();
});

test.each([
  ['otra cooperativa', (r) => (r.cooperativeId = 'otra')],
  ['sin propietario', (r) => (r.ownerId = '')],
  ['estado desconocido', (r) => (r.status = 'CONFIRMED')],
  ['total inválido', (r) => (r.totalPriceCents = 'mucho')],
  ['sin pasajeros', (r) => delete r.summary.passengers],
  ['pasajero sin nombre', (r) => (r.summary.passengers[0].fullName = ' ')],
])('dato incoherente (%s) falla con error de integridad', async (_label, corrupt) => {
  const value = row();
  corrupt(value);
  await expect(harness(value).find(target)).rejects.toMatchObject({
    code: 'BOOKING_NOTIFICATION_DATA_INTEGRITY_ERROR',
  });
});

test.each([
  ['ECONNRESET', 'BOOKING_NOTIFICATION_QUERY_UNAVAILABLE'],
  ['XX000', 'BOOKING_NOTIFICATION_DATA_INTEGRITY_ERROR'],
])('fallo %s se clasifica como %s sin filtrar detalles', async (pgCode, code) => {
  const h = harness();
  h.pool.query.mockRejectedValue(Object.assign(new Error('SQL privado'), { code: pgCode }));
  const error = await h.find(target).catch((e) => e);
  expect(error.code).toBe(code);
  expect(error.message).not.toMatch(/SQL/);
});
