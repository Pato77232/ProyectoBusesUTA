import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTicketsController,
  validBookingId,
  validSheet,
} from '../../src/tickets/tickets-controller.js';

const bookingId = 'aaaaaaaa-0000-4000-8000-000000000001';
const code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function sheet() {
  return {
    bookingId,
    currency: 'USD',
    totalPriceCents: 1000,
    trip: {
      departureDate: '2026-11-10',
      origin: { position: 0, locationKey: 'Ambato', departureAt: '2026-11-10T08:00:00-05:00' },
      destination: { position: 1, locationKey: 'Quito', arrivalAt: '2026-11-10T10:30:00-05:00' },
    },
    tickets: [
      {
        ticketId: 't-1',
        code,
        qrPayload: `TRANSVIAJE:TICKET:${code}`,
        qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        issuedAt: '2026-11-04T15:00:00.000Z',
        seatId: 'seat-1',
        passenger: { fullName: 'Pasajera Uno', identificationNumber: '1710034065' },
        totalPriceCents: 1000,
      },
    ],
  };
}

function harness(request) {
  const states = [];
  const busy = [];
  const calls = [];
  const controller = createTicketsController({
    client: {
      request: async (path) => {
        calls.push(path);
        return request(path);
      },
    },
    view: {
      busy: (value) => busy.push(value),
      show: (...args) => states.push(args),
    },
  });
  return { controller, states, busy, calls };
}

test('muestra los boletos de la reserva pedida', async () => {
  const value = sheet();
  const h = harness(async () => value);
  await h.controller.showSheet(bookingId);
  assert.deepEqual(h.calls, [`/api/v1/tickets/bookings/${bookingId}`]);
  assert.equal(h.states[0][0], 'loading');
  assert.deepEqual(h.states.at(-1), ['ready', 'Tu boleto está listo.', { sheet: value }]);
  assert.deepEqual(h.busy, [true, false]);
});

test('varias entradas usan plural', async () => {
  const value = sheet();
  value.tickets.push({ ...value.tickets[0], ticketId: 't-2', code: 'A'.repeat(26) });
  value.tickets[1].qrPayload = `TRANSVIAJE:TICKET:${'A'.repeat(26)}`;
  const h = harness(async () => value);
  await h.controller.showSheet(bookingId);
  assert.equal(h.states.at(-1)[1], 'Tus 2 boletos están listos.');
});

test('identificadores de reserva inseguros no llegan a la API', async () => {
  for (const id of ['', '   ', '../admin', 'a/b', 'a#b', 'a?b', 'x'.repeat(201)]) {
    const h = harness(async () => sheet());
    await h.controller.showSheet(id);
    assert.equal(h.calls.length, 0, id);
    assert.equal(h.states.at(-1)[0], 'empty');
  }
  assert.equal(validBookingId(bookingId), true);
});

test('404, 401, 403 y fallos se distinguen sin mostrar boletos antiguos', async () => {
  const cases = [
    [{ status: 404 }, 'empty'],
    [{ status: 401 }, 'auth'],
    [{ status: 403 }, 'forbidden'],
    [{ status: 503 }, 'error'],
    [new Error('red'), 'error'],
  ];
  for (const [error, mode] of cases) {
    const h = harness(async () => {
      throw error;
    });
    await h.controller.showSheet(bookingId);
    assert.equal(h.states.at(-1)[0], mode);
    assert.deepEqual(h.states.at(-1)[2], {});
  }
});

test('una respuesta incompleta o alterada se trata como error, no como boleto', async () => {
  const corruptions = [
    (s) => (s.bookingId = 'otra'),
    (s) => (s.tickets = []),
    (s) => (s.tickets[0].code = 'abc'),
    (s) => (s.tickets[0].qrPayload = 'TRANSVIAJE:TICKET:OTRO'),
    (s) => (s.tickets[0].qrSvg = '<script>alert(1)</script>'),
    (s) => (s.tickets[0].passenger.identificationNumber = '123'),
    (s) => (s.trip.origin.departureAt = 'mañana'),
    (s) => (s.currency = 'EUR'),
    (s) => s.tickets.push({ ...s.tickets[0], ticketId: 't-2' }),
  ];
  for (const corrupt of corruptions) {
    const value = sheet();
    corrupt(value);
    assert.equal(validSheet(value, bookingId), false);
    const h = harness(async () => value);
    await h.controller.showSheet(bookingId);
    assert.equal(h.states.at(-1)[0], 'error');
  }
});

test('lista solo compras vendidas y conserva el cursor para ver más', async () => {
  const sold = {
    bookingId,
    status: 'SOLD',
    soldAt: '2026-11-04T14:02:00.000Z',
    totalPriceCents: 1000,
    currency: 'USD',
  };
  const pending = { ...sold, bookingId: 'b-2', status: 'PENDING_PAYMENT', soldAt: null };
  const h = harness(async () => ({ bookings: { items: [pending, sold], nextCursor: 'cursor-2' } }));
  await h.controller.listSold();
  assert.equal(h.calls[0], '/api/v1/bookings?limit=20');
  assert.deepEqual(h.states.at(-1), [
    'list',
    'Elige una compra para ver sus boletos.',
    { bookings: [sold], nextCursor: 'cursor-2' },
  ]);
  await h.controller.listSold('cursor-2');
  assert.equal(h.calls[1], '/api/v1/bookings?limit=20&cursor=cursor-2');
});

test('una lista sin el envoltorio bookings se trata como error', async () => {
  const h = harness(async () => ({ items: [] }));
  await h.controller.listSold();
  assert.equal(h.states.at(-1)[0], 'error');
});

test('sin compras vendidas informa vacío; sin sesión pide iniciar sesión', async () => {
  const empty = harness(async () => ({ bookings: { items: [], nextCursor: null } }));
  await empty.controller.listSold();
  assert.equal(empty.states.at(-1)[0], 'empty');
  const auth = harness(async () => {
    throw { status: 401 };
  });
  await auth.controller.listSold();
  assert.equal(auth.states.at(-1)[0], 'auth');
});

test('no lanza una segunda carga mientras otra sigue en curso', async () => {
  let release;
  const h = harness(() => new Promise((resolve) => (release = () => resolve(sheet()))));
  const first = h.controller.showSheet(bookingId);
  await h.controller.showSheet(bookingId);
  release();
  await first;
  assert.equal(h.calls.length, 1);
});
