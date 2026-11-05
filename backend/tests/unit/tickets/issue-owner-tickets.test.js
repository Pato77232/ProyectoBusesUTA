const createIssueOwnerTickets = require('../../../src/modules/tickets/application/issue-owner-tickets');
const TicketError = require('../../../src/modules/tickets/domain/ticket-error');
const { qrPayload } = require('../../../src/modules/tickets/domain/ticket-code');

const ISSUED_AT = new Date('2026-11-04T15:00:00.000Z');
const target = { bookingId: 'venta-opaca/qa', ownerId: 'propietario-privado' };

function sale() {
  return Object.freeze({
    bookingId: 'venta-opaca/qa',
    cooperativeId: 'coop-ticket',
    tripId: 'trip-ticket',
    fromPosition: 0,
    toPosition: 1,
    soldAt: '2026-11-04T14:02:00.000Z',
    currency: 'USD',
    totalPriceCents: 1000,
    passengers: [
      {
        seatId: 'seat-1',
        fullName: 'Pasajera Uno',
        identificationNumber: '1710034065',
        totalPriceCents: 600,
      },
      {
        seatId: 'seat-2',
        fullName: 'Pasajero Dos',
        identificationNumber: '1710034065',
        totalPriceCents: 400,
      },
    ],
    trip: {
      departureDate: '2026-11-10',
      origin: { position: 0, locationKey: 'Ambato', departureAt: '2026-11-10T08:00:00-05:00' },
      destination: {
        position: 1,
        locationKey: 'Latacunga',
        arrivalAt: '2026-11-10T08:50:00-05:00',
      },
    },
  });
}

/** Repositorio en memoria con la semántica de ON CONFLICT (booking_id, seat_id) DO NOTHING. */
function memoryRepository() {
  const rows = new Map();
  return {
    rows,
    issueMissing: jest.fn(async ({ cooperativeId, bookingId, issuedAt, tickets }) => {
      for (const { id, seatId, code } of tickets) {
        const key = `${bookingId}|${seatId}`;
        if (!rows.has(key)) rows.set(key, { id, cooperativeId, bookingId, seatId, code, issuedAt });
      }
      return [...rows.values()].filter((r) => r.bookingId === bookingId);
    }),
  };
}

function harness({ found = sale(), repository = memoryRepository() } = {}) {
  let sequence = 0;
  const soldBookings = { findSoldForOwner: jest.fn(async () => found) };
  const issue = createIssueOwnerTickets({
    soldBookings,
    ticketRepository: repository,
    newTicketId: () => `00000000-0000-4000-8000-00000000000${++sequence}`,
    newTicketCode: () => String.fromCharCode(64 + sequence).repeat(26),
    clock: () => ISSUED_AT,
  });
  return { issue, soldBookings, repository };
}

test('emite un boleto por pasajero con el QR opaco y los datos congelados del viaje', async () => {
  const h = harness();
  const sheet = await h.issue(target);
  expect(h.soldBookings.findSoldForOwner).toHaveBeenCalledWith(target);
  expect(sheet).toMatchObject({
    bookingId: target.bookingId,
    currency: 'USD',
    totalPriceCents: 1000,
    trip: { departureDate: '2026-11-10', origin: { locationKey: 'Ambato' } },
  });
  expect(sheet.tickets).toHaveLength(2);
  expect(sheet.tickets[0]).toEqual({
    ticketId: '00000000-0000-4000-8000-000000000001',
    code: 'A'.repeat(26),
    qrPayload: `TRANSVIAJE:TICKET:${'A'.repeat(26)}`,
    issuedAt: ISSUED_AT.toISOString(),
    seatId: 'seat-1',
    passenger: { fullName: 'Pasajera Uno', identificationNumber: '1710034065' },
    totalPriceCents: 600,
  });
  expect(sheet.tickets.map((t) => t.seatId)).toEqual(['seat-1', 'seat-2']);
  expect(Object.isFrozen(sheet)).toBe(true);
  expect(Object.isFrozen(sheet.tickets[0].passenger)).toBe(true);
  expect(h.repository.issueMissing).toHaveBeenCalledWith(
    expect.objectContaining({
      cooperativeId: 'coop-ticket',
      bookingId: target.bookingId,
      issuedAt: ISSUED_AT,
    }),
  );
});

test('consultar otra vez devuelve los mismos boletos y códigos', async () => {
  const h = harness();
  const first = await h.issue(target);
  const second = await h.issue(target);
  expect(second.tickets.map((t) => [t.ticketId, t.code])).toEqual(
    first.tickets.map((t) => [t.ticketId, t.code]),
  );
  expect(h.repository.rows.size).toBe(2);
});

test('el QR no lleva cédula, nombre ni identificadores internos', async () => {
  const sheet = await harness().issue(target);
  for (const ticket of sheet.tickets) {
    expect(ticket.qrPayload).toMatch(/^TRANSVIAJE:TICKET:[A-Z2-7]{26}$/);
    expect(ticket.qrPayload).not.toMatch(/1710034065|Pasajer|venta-opaca|coop-ticket|seat-/);
  }
});

test.each([
  null,
  undefined,
  [],
  {},
  { bookingId: 'b' },
  { ownerId: 'o' },
  { bookingId: '  ', ownerId: 'o' },
  { bookingId: 'b', ownerId: 3 },
  { bookingId: 'x'.repeat(201), ownerId: 'o' },
])('solicitud inválida %j responde 400 sin consultar Reservas', async (input) => {
  const h = harness();
  await expect(h.issue(input)).rejects.toMatchObject({
    code: 'TICKET_QUERY_INVALID',
    httpStatus: 400,
  });
  expect(h.soldBookings.findSoldForOwner).not.toHaveBeenCalled();
});

test('reserva ajena, ausente o no vendida responde 404 sin emitir', async () => {
  const h = harness({ found: null });
  await expect(h.issue(target)).rejects.toMatchObject({
    code: 'TICKET_NOT_FOUND',
    httpStatus: 404,
  });
  expect(h.repository.issueMissing).not.toHaveBeenCalled();
});

test.each([
  ['BOOKING_TICKET_QUERY_UNAVAILABLE', 'TICKET_UNAVAILABLE', 503],
  ['BOOKING_TICKET_DATA_INTEGRITY_ERROR', 'TICKET_INTEGRITY_ERROR', 500],
  ['BOOKING_TICKET_QUERY_INVALID', 'TICKET_QUERY_INVALID', 400],
  [undefined, 'TICKET_INTEGRITY_ERROR', 500],
])('error de Reservas %s se traduce a %s sin emitir', async (source, code, httpStatus) => {
  const h = harness();
  h.soldBookings.findSoldForOwner.mockRejectedValue(
    Object.assign(new Error('detalle privado'), { code: source }),
  );
  const error = await h.issue(target).catch((e) => e);
  expect(error).toBeInstanceOf(TicketError);
  expect(error).toMatchObject({ code, httpStatus });
  expect(error.message).not.toMatch(/detalle privado/);
  expect(h.repository.issueMissing).not.toHaveBeenCalled();
});

test.each([
  ['ECONNRESET', 'TICKET_UNAVAILABLE', 503],
  ['40P01', 'TICKET_UNAVAILABLE', 503],
  ['23505', 'TICKET_INTEGRITY_ERROR', 500],
])('fallo de almacenamiento %s se clasifica como %s', async (pgCode, code, httpStatus) => {
  const repository = {
    issueMissing: jest.fn().mockRejectedValue(Object.assign(new Error('SQL'), { code: pgCode })),
  };
  await expect(harness({ repository }).issue(target)).rejects.toMatchObject({ code, httpStatus });
});

const inconsistentStorage = [
  ['falta un boleto', (rows) => rows.slice(1)],
  ['boleto de más', (rows) => [...rows, { ...rows[0], seatId: 'extra' }]],
  ['asiento repetido', (rows) => [rows[0], { ...rows[1], seatId: rows[0].seatId }]],
  ['otra cooperativa', (rows) => [{ ...rows[0], cooperativeId: 'otra' }, rows[1]]],
  ['otra reserva', (rows) => [{ ...rows[0], bookingId: 'otra' }, rows[1]]],
  ['código inválido', (rows) => [{ ...rows[0], code: 'corto' }, rows[1]]],
  ['fecha inválida', (rows) => [{ ...rows[0], issuedAt: 'nunca' }, rows[1]]],
  ['sin identificador', (rows) => [{ ...rows[0], id: '' }, rows[1]]],
];

test.each(inconsistentStorage)(
  'almacenamiento con %s falla sin lista parcial',
  async (_label, alter) => {
    const memory = memoryRepository();
    const repository = {
      issueMissing: jest.fn(async (input) => alter(await memory.issueMissing(input))),
    };
    await expect(harness({ repository }).issue(target)).rejects.toMatchObject({
      code: 'TICKET_INTEGRITY_ERROR',
      httpStatus: 500,
    });
  },
);

test('qrPayload rechaza códigos que no son base32 de 26 caracteres', () => {
  expect(() => qrPayload('a'.repeat(26))).toThrow(TicketError);
  expect(() => qrPayload('A'.repeat(25))).toThrow(TicketError);
  expect(qrPayload('A2'.repeat(13))).toBe(`TRANSVIAJE:TICKET:${'A2'.repeat(13)}`);
});

test('no se construye sin sus dependencias', () => {
  expect(() => createIssueOwnerTickets({})).toThrow(TypeError);
});
