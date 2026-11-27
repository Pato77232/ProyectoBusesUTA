const http = require('node:http');
const { randomUUID } = require('node:crypto');
const PgCounterCashSales = require('../../../src/modules/bookings/infrastructure/pg-counter-cash-sales');
const { start } = require('../../../src/server');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { fleetFixtures, busRequest } = require('../../helpers/fleet-bus');
const makeFixture = require('../../helpers/route-programming');
const Browser = require('../../helpers/session-browser');
const PASSWORD = 'clave-disponibilidad-ficticia-2030';
let pool,
  running,
  hash,
  admin,
  customer,
  clerk,
  otherClerk,
  owner,
  other,
  fixture,
  tripId,
  seats,
  baseUrl;
async function clear() {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE tickets,booking_benefit_reviews,booking_guest_access_tokens,booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
  );
  await pool.query('TRUNCATE cooperatives,users,auth_sessions CASCADE');
}
beforeAll(async () => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  hash = await (await createHasher()).hash(PASSWORD);
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  running = await start({
    PORT: String(port),
    DATABASE_URL: assertTestDatabase(),
    JWT_SECRET: 'disponibilidad-real-qa-secret-1234567890',
    NODE_ENV: 'test',
    BOOKING_EXPIRATION_ENABLED: 'false',
  });
  baseUrl = `http://127.0.0.1:${port}`;
});
afterAll(async () => {
  if (running) await running.stop();
  if (pool) {
    await clear();
    await pool.end();
  }
});
beforeEach(async () => {
  await clear();
  ({ first: owner, second: other } = await fleetFixtures(pool));
  const bus = await new PgBusRepository(pool).create(
    busRequest({ ...owner, data: { vipSeatKeys: ['deck-1-0-1'] } }),
  );
  fixture = makeFixture({ ...owner, busId: bus.id, date: '2030-01-01' });
  for (const frequency of fixture.frequencies)
    await pool.query(
      'INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,$3,$4,$5,$6)',
      [
        frequency.id,
        owner.cooperativeId,
        frequency.origin,
        frequency.destination,
        frequency.departureTime,
        frequency.antResolutionNumber,
      ],
    );
  await pool.query(
    "INSERT INTO frequency_stops(frequency_id,position,place) VALUES($1,0,'Salcedo')",
    [fixture.frequencies[0].id],
  );
  fixture.body.programming.agendas[0].activities[0].points = [
    { position: 0, departureAt: '2030-01-01T07:00:00-05:00' },
    {
      position: 1,
      arrivalAt: '2030-01-01T07:25:00-05:00',
      departureAt: '2030-01-01T07:30:00-05:00',
    },
    { position: 2, arrivalAt: '2030-01-01T08:00:00-05:00' },
  ];
  await pool.query(
    "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES('availability-admin@example.ec',$1,'COOPERATIVE_ADMIN',$2),('availability-customer@example.ec',$1,'CUSTOMER',NULL),('counter-clerk@example.ec',$1,'CLERK',$2),('counter-other@example.ec',$1,'CLERK',$3)",
    [hash, owner.cooperativeId, other.cooperativeId],
  );
  admin = new Browser(baseUrl);
  customer = new Browser(baseUrl);
  clerk = new Browser(baseUrl);
  otherClerk = new Browser(baseUrl);
  await admin.login('availability-admin@example.ec', PASSWORD);
  await customer.login('availability-customer@example.ec', PASSWORD);
  await clerk.login('counter-clerk@example.ec', PASSWORD);
  await otherClerk.login('counter-other@example.ec', PASSWORD);
  const created = await admin.request('/api/v1/route-sheets', 'POST', {
    busGroupId: owner.busGroupId,
    routeDate: '2030-01-01',
  });
  expect(created.status).toBe(201);
  const sheetId = (await created.json()).routeSheet.id;
  const endpoint = `/api/v1/route-sheets/${sheetId}`;
  expect((await admin.request(endpoint + '/programming', 'PUT', fixture.body)).status).toBe(200);
  expect(
    (
      await admin.request(endpoint + '/tariff', 'PUT', {
        expectedRevision: 0,
        policy: {
          vipSurchargeBps: 2500,
          minorDiscountBps: 10000,
          seniorDiscountBps: 5000,
          disabilityDiscountBps: 5000,
        },
        frequencies: fixture.frequencies.map((f, index) => ({
          frequencyId: f.id,
          prices:
            index === 0
              ? [
                  { fromPosition: 0, toPosition: 1, amountCents: 200 },
                  { fromPosition: 0, toPosition: 2, amountCents: 450 },
                  { fromPosition: 1, toPosition: 2, amountCents: 300 },
                ]
              : [{ fromPosition: 0, toPosition: 1, amountCents: 450 }],
        })),
      })
    ).status,
  ).toBe(200);
  const published = await admin.request(endpoint + '/publish', 'POST', {});
  expect(published.status).toBe(200);
  tripId = (await published.json()).routeSheet.commercial.tripIds[0];
  const initial = await clerk.request(
    `/api/v1/counter/availability?tripId=${tripId}&fromPosition=0&toPosition=2`,
  );
  expect(initial.status).toBe(200);
  seats = (await initial.json()).seats;
});

function sale({ seat = seats[0].seatId, birthDate = '1990-01-01', verified = true } = {}) {
  return {
    tripId,
    fromPosition: 0,
    toPosition: 2,
    seatIds: [seat],
    passengers: [
      {
        seatId: seat,
        identificationNumber: '0100000009',
        fullName: 'Pasajero de Boletería',
        birthDate,
      },
    ],
    decisions: [{ seatId: seat, birthDateVerified: verified, disabilityVerified: false }],
  };
}
function send(browser, path, body, headers = {}) {
  return fetch(browser.baseUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': browser.csrf,
      cookie: [...browser.cookies].map(([name, value]) => `${name}=${value}`).join('; '),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
async function counterBooking(body = sale()) {
  const quoted = await send(clerk, '/api/v1/counter/bookings/summary', body);
  expect(quoted.status).toBe(200);
  const { summary, summaryRevision } = await quoted.json();
  const created = await send(
    clerk,
    '/api/v1/counter/bookings',
    { ...body, summaryAccepted: true, acceptedSummaryRevision: summaryRevision },
    { 'Idempotency-Key': randomUUID() },
  );
  expect(created.status).toBe(201);
  return { summary, booking: (await created.json()).booking };
}
const cash = (browser, bookingId, body) =>
  send(browser, `/api/v1/counter/bookings/${encodeURIComponent(bookingId)}/cash`, body);
const availability = () =>
  clerk.request(`/api/v1/counter/availability?tripId=${tripId}&fromPosition=0&toPosition=2`);

describe('BOOK-CAJA-02: venta en boletería', () => {
  test('el oficinista vende sin cuenta del comprador, cobra en efectivo y emite el boleto', async () => {
    const { summary, booking } = await counterBooking();
    const receipt = randomUUID();
    const amountCents = summary.totals.totalPriceCents;
    const paid = await cash(clerk, booking.bookingId, { cashReceiptId: receipt, amountCents });
    expect(paid.status).toBe(200);
    expect((await paid.json()).sale).toMatchObject({
      bookingId: booking.bookingId,
      status: 'SOLD',
    });
    const clerkId = (
      await pool.query("SELECT id FROM users WHERE email='counter-clerk@example.ec'")
    ).rows[0].id;
    const { rows } = await pool.query(
      'SELECT owner_id,status,sold_by,cash_receipt_id,proof_reception_state FROM bookings WHERE id=$1',
      [booking.bookingId],
    );
    expect(rows[0]).toEqual({
      owner_id: `counter:${owner.cooperativeId}`,
      status: 'SOLD',
      sold_by: clerkId,
      cash_receipt_id: receipt,
      proof_reception_state: 'NOT_RECEIVED',
    });
    const again = await cash(clerk, booking.bookingId, { cashReceiptId: receipt, amountCents });
    expect(again.status).toBe(200);
    const tickets = await clerk.request(`/api/v1/tickets/counter/bookings/${booking.bookingId}`);
    expect(tickets.status).toBe(200);
    const sheet = await tickets.json();
    expect(sheet.tickets).toHaveLength(1);
    expect(sheet.tickets[0].qrPayload).toBe(`TRANSVIAJE:TICKET:${sheet.tickets[0].code}`);
    expect(sheet.tickets[0].passenger.fullName).toBe('Pasajero de Boletería');
    const after = await (await availability()).json();
    expect(after.seats.find((s) => s.seatId === seats[0].seatId).status).toBe('SOLD');
    const history = await (await customer.request('/api/v1/bookings')).json();
    expect(history.bookings.items).toHaveLength(0);
  });

  test('otra cooperativa no puede cotizar, cobrar ni ver los boletos', async () => {
    const quoted = await send(otherClerk, '/api/v1/counter/bookings/summary', sale());
    expect(quoted.status).toBe(404);
    const { summary, booking } = await counterBooking();
    const foreign = await cash(otherClerk, booking.bookingId, {
      cashReceiptId: randomUUID(),
      amountCents: summary.totals.totalPriceCents,
    });
    expect(foreign.status).toBe(404);
    expect((await foreign.json()).error.code).toBe('BOOKING_CASH_NOT_FOUND');
    const tickets = await otherClerk.request(
      `/api/v1/tickets/counter/bookings/${booking.bookingId}`,
    );
    expect(tickets.status).toBe(404);
  });

  test('solo el oficinista usa la boletería', async () => {
    expect((await send(customer, '/api/v1/counter/bookings/summary', sale())).status).toBe(403);
    expect((await send(admin, '/api/v1/counter/bookings/summary', sale())).status).toBe(403);
  });

  // BOOK-BENEF-02: la fecha de nacimiento ya no exige la marca de verificación.
  test('cotiza sin marcar la fecha de nacimiento como verificada', async () => {
    const quoted = await send(clerk, '/api/v1/counter/bookings/summary', sale({ verified: false }));
    expect(quoted.status).toBe(200);
  });

  test('aplica el descuento de tercera edad acreditado por el oficinista', async () => {
    const regular = await (await send(clerk, '/api/v1/counter/bookings/summary', sale())).json();
    const senior = await (
      await send(clerk, '/api/v1/counter/bookings/summary', sale({ birthDate: '1950-01-01' }))
    ).json();
    expect(senior.summary.totals.discountCents).toBeGreaterThan(0);
    expect(senior.summary.totals.totalPriceCents).toBeLessThan(
      regular.summary.totals.totalPriceCents,
    );
  });

  test('rechaza un importe distinto y un segundo recibo', async () => {
    const { summary, booking } = await counterBooking();
    const amountCents = summary.totals.totalPriceCents;
    const wrong = await cash(clerk, booking.bookingId, {
      cashReceiptId: randomUUID(),
      amountCents: amountCents + 1,
    });
    expect(wrong.status).toBe(409);
    expect(
      (await cash(clerk, booking.bookingId, { cashReceiptId: randomUUID(), amountCents })).status,
    ).toBe(200);
    const second = await cash(clerk, booking.bookingId, {
      cashReceiptId: randomUUID(),
      amountCents,
    });
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe('BOOKING_CASH_CONFLICT');
  });

  test('un asiento ya reservado en boletería no se vuelve a reservar', async () => {
    await counterBooking();
    const quoted = await (await send(clerk, '/api/v1/counter/bookings/summary', sale())).json();
    const second = await send(
      clerk,
      '/api/v1/counter/bookings',
      { ...sale(), summaryAccepted: true, acceptedSummaryRevision: quoted.summaryRevision },
      { 'Idempotency-Key': randomUUID() },
    );
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe('BOOKING_SEAT_CONFLICT');
  });

  test('sin cobro dentro del plazo responde vencida y no vende', async () => {
    const { summary, booking } = await counterBooking();
    const late = new PgCounterCashSales({
      pool,
      clock: () => new Date(Date.now() + 10 * 60 * 1000),
    });
    await expect(
      late.confirmCash({
        bookingId: booking.bookingId,
        cooperativeId: owner.cooperativeId,
        ownerId: `counter:${owner.cooperativeId}`,
        actorId: 'actor',
        cashReceiptId: randomUUID(),
        amountCents: summary.totals.totalPriceCents,
      }),
    ).rejects.toMatchObject({ code: 'BOOKING_CASH_EXPIRED' });
    const { rows } = await pool.query('SELECT status FROM bookings WHERE id=$1', [
      booking.bookingId,
    ]);
    expect(rows[0].status).toBe('PENDING_PAYMENT');
  });

  test('la base rechaza una venta de boletería sin recibo o a nombre de otra cooperativa', async () => {
    const { booking } = await counterBooking();
    await expect(
      pool.query("UPDATE bookings SET status='SOLD',sold_at=now() WHERE id=$1", [
        booking.bookingId,
      ]),
    ).rejects.toThrow();
    await expect(
      pool.query('UPDATE bookings SET owner_id=$2 WHERE id=$1', [
        booking.bookingId,
        `counter:${other.cooperativeId}`,
      ]),
    ).rejects.toThrow();
  });
});
