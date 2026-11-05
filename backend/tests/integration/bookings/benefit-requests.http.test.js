const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { start } = require('../../../src/server');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { fleetFixtures, busRequest } = require('../../helpers/fleet-bus');
const fixtureFor = require('../../helpers/route-programming');
const Browser = require('../../helpers/session-browser');
const endpoint = '/api/v1/booking-benefit-requests';
const password = 'benefit-request-qa-2030';
let pool, running, baseUrl, customer, another, clerk, foreign, admin, tripId, seatId, owner;
function input(requestKey = randomUUID()) {
  return {
    tripId,
    fromPosition: 0,
    toPosition: 1,
    requestKey,
    seatIds: [seatId],
    passengers: [
      {
        seatId,
        fullName: 'Persona QA',
        birthDate: '1990-01-01',
        identificationNumber: '0100000009',
      },
    ],
  };
}
async function count() {
  return (await pool.query('SELECT count(*)::int n FROM booking_benefit_requests')).rows[0].n;
}
async function rows() {
  return (await pool.query('SELECT * FROM booking_benefit_requests ORDER BY id')).rows;
}
beforeAll(async () => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  await pool.query(
    'TRUNCATE booking_benefit_requests,booking_guest_access_tokens,booking_benefit_reviews,booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
  );
  await pool.query('TRUNCATE cooperatives,users,auth_sessions CASCADE');
  const probe = http.createServer();
  await new Promise((r) => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  running = await start({
    PORT: String(port),
    DATABASE_URL: assertTestDatabase(),
    NODE_ENV: 'test',
    JWT_SECRET: 'benefit-request-qa-secret-1234567890',
    BOOKING_EXPIRATION_ENABLED: 'false',
  });
  baseUrl = `http://127.0.0.1:${port}`;
  const fixtures = await fleetFixtures(pool);
  owner = fixtures.first;
  const bus = await new PgBusRepository(pool).create(busRequest(owner));
  const fixture = fixtureFor({ ...owner, busId: bus.id, date: '2030-01-01' });
  for (const f of fixture.frequencies)
    await pool.query(
      `INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number)
    VALUES($1,$2,$3,$4,$5,'ANT-QA')`,
      [f.id, owner.cooperativeId, f.origin, f.destination, f.departureTime],
    );
  const hash = await (await createHasher()).hash(password);
  for (const [email, role, tenant] of [
    ['benefit-admin@example.ec', 'COOPERATIVE_ADMIN', owner.cooperativeId],
    ['benefit-customer@example.ec', 'CUSTOMER', null],
    ['benefit-another@example.ec', 'CUSTOMER', null],
    ['benefit-clerk@example.ec', 'CLERK', owner.cooperativeId],
    ['benefit-foreign@example.ec', 'CLERK', fixtures.second.cooperativeId],
  ])
    await pool.query(
      'INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',
      [email, hash, role, tenant],
    );
  admin = new Browser(baseUrl);
  customer = new Browser(baseUrl);
  another = new Browser(baseUrl);
  clerk = new Browser(baseUrl);
  foreign = new Browser(baseUrl);
  for (const [browser, email] of [
    [admin, 'benefit-admin@example.ec'],
    [customer, 'benefit-customer@example.ec'],
    [another, 'benefit-another@example.ec'],
    [clerk, 'benefit-clerk@example.ec'],
    [foreign, 'benefit-foreign@example.ec'],
  ])
    await browser.login(email, password);
  const created = await admin.request('/api/v1/route-sheets', 'POST', {
    busGroupId: owner.busGroupId,
    routeDate: '2030-01-01',
  });
  expect(created.status).toBe(201);
  const path = '/api/v1/route-sheets/' + (await created.json()).routeSheet.id;
  expect((await admin.request(path + '/programming', 'PUT', fixture.body)).status).toBe(200);
  expect(
    (
      await admin.request(path + '/tariff', 'PUT', {
        expectedRevision: 0,
        policy: {
          vipSurchargeBps: 2500,
          minorDiscountBps: 5000,
          seniorDiscountBps: 5000,
          disabilityDiscountBps: 5000,
        },
        frequencies: fixture.frequencies.map((f) => ({
          frequencyId: f.id,
          prices: [{ fromPosition: 0, toPosition: 1, amountCents: 450 }],
        })),
      })
    ).status,
  ).toBe(200);
  const published = await admin.request(path + '/publish', 'POST', {});
  expect(published.status).toBe(200);
  tripId = (await published.json()).routeSheet.commercial.tripIds[0];
  const availability = await customer.request(
    `/api/v1/bookings/availability?tripId=${tripId}&fromPosition=0&toPosition=1`,
  );
  expect(availability.status).toBe(200);
  seatId = (await availability.json()).seats[0].seatId;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE booking_benefit_requests,booking_benefit_reviews');
});
afterAll(async () => {
  if (running) await running.stop();
  if (pool) {
    await pool.query('TRUNCATE booking_benefit_requests,booking_benefit_reviews');
    await pool.end();
  }
});
test('crea solicitud real y expone manifiesto solo al CLERK propio, sin reservar o acreditar', async () => {
  const response = await customer.request(endpoint, 'POST', input());
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json();
  expect(body.request).toMatchObject({
    tripId,
    status: 'PENDING',
    revision: 1,
    passengerCount: 1,
    fromPlace: 'Ambato',
    toPlace: 'Latacunga',
  });
  expect(JSON.stringify(body)).not.toMatch(/0100000009|Persona QA|ownerId/);
  const own = await customer.request(endpoint + '/' + body.request.requestId);
  expect(own.status).toBe(200);
  expect((await own.json()).request).not.toHaveProperty('passengers');
  const detail = await clerk.request(endpoint + '/' + body.request.requestId);
  expect(detail.status).toBe(200);
  expect((await detail.json()).request.passengers).toEqual(input().passengers);
  const queue = await clerk.request(endpoint);
  expect(queue.status).toBe(200);
  expect(JSON.stringify(await queue.json())).not.toMatch(/0100000009|Persona QA|ownerId|birthDate/);
  expect(
    (
      await pool.query(
        'SELECT (SELECT count(*) FROM bookings)::int bookings,(SELECT count(*) FROM booking_seat_allocations)::int seats,(SELECT count(*) FROM booking_benefit_reviews)::int reviews',
      )
    ).rows[0],
  ).toEqual({ bookings: 0, seats: 0, reviews: 0 });
});
test('autenticación, roles y CSRF se aplican antes de cualquier escritura', async () => {
  expect((await new Browser(baseUrl).request(endpoint, 'POST', input())).status).toBe(401);
  expect((await clerk.request(endpoint, 'POST', input())).status).toBe(403);
  expect((await customer.request(endpoint, 'POST', input(), '')).status).toBe(403);
  expect((await customer.request(endpoint)).status).toBe(403);
  expect((await admin.request(endpoint)).status).toBe(403);
  expect(await count()).toBe(0);
});
test('cooperativa ajena, otro propietario y ausencia dan 404 idéntico', async () => {
  const id = (await (await customer.request(endpoint, 'POST', input())).json()).request.requestId;
  const a = await another.request(endpoint + '/' + id),
    b = await foreign.request(endpoint + '/' + id),
    c = await clerk.request(endpoint + '/' + randomUUID());
  expect([a.status, b.status, c.status]).toEqual([404, 404, 404]);
  expect(await a.json()).toEqual(await b.json());
  const queue = await foreign.request(endpoint);
  expect((await queue.json()).requests).toEqual([]);
});
test('campos de autoridad del cliente y queries extra se rechazan sin efectos', async () => {
  for (const extra of [
    { ownerId: randomUUID() },
    { cooperativeId: randomUUID() },
    { price: 1 },
    { decisions: [] },
  ])
    expect((await customer.request(endpoint, 'POST', { ...input(), ...extra })).status).toBe(400);
  expect((await clerk.request(endpoint + '?cooperativeId=' + owner.cooperativeId)).status).toBe(
    400,
  );
  expect((await clerk.request(endpoint + '?limit=101')).status).toBe(400);
  expect(await count()).toBe(0);
});
test('dos reintentos simultáneos crean una sola fila y recuperan el mismo resultado', async () => {
  const request = input();
  const responses = await Promise.all([
    customer.request(endpoint, 'POST', request),
    customer.request(endpoint, 'POST', request),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
  const bodies = await Promise.all(responses.map((r) => r.json()));
  expect(bodies[0].request.requestId).toBe(bodies[1].request.requestId);
  expect(bodies[0].request.createdAt).toBe(bodies[1].request.createdAt);
  expect(await count()).toBe(1);
});
test('misma clave con contenido diferente nunca reemplaza la primera solicitud', async () => {
  const request = input();
  expect((await customer.request(endpoint, 'POST', request)).status).toBe(201);
  const before = await rows();
  request.passengers[0].fullName = 'Otra Persona';
  expect((await customer.request(endpoint, 'POST', request)).status).toBe(409);
  expect(await rows()).toEqual(before);
});
test('respuesta perdida se recupera reintentando sin depender de sesión usada como credencial durable', async () => {
  const request = input();
  await customer.request(endpoint, 'POST', request);
  const before = await rows();
  const replay = await customer.request(endpoint, 'POST', request);
  expect(replay.status).toBe(200);
  expect(await rows()).toEqual(before);
  expect((await another.request(endpoint, 'POST', request)).status).toBe(201);
  expect(await count()).toBe(2);
});
test('bandeja paginada no duplica filas y cursor fuera del tenant no indica lista vacía', async () => {
  for (let n = 0; n < 3; n++)
    expect((await customer.request(endpoint, 'POST', input())).status).toBe(201);
  const first = await (await clerk.request(endpoint + '?limit=2')).json();
  const second = await (
    await clerk.request(endpoint + '?limit=2&cursor=' + first.nextCursor)
  ).json();
  expect(first.requests).toHaveLength(2);
  expect(second.requests).toHaveLength(1);
  expect(second.nextCursor).toBeNull();
  expect(new Set([...first.requests, ...second.requests].map((r) => r.requestId)).size).toBe(3);
  expect((await foreign.request(endpoint + '?cursor=' + first.nextCursor)).status).toBe(400);
});
test('fallos de contexto no se convierten en solicitudes válidas o reservas', async () => {
  expect(
    (await customer.request(endpoint, 'POST', { ...input(), tripId: randomUUID() })).status,
  ).toBe(404);
  const request = input();
  request.seatIds = [randomUUID()];
  request.passengers[0].seatId = request.seatIds[0];
  expect((await customer.request(endpoint, 'POST', request)).status).toBe(400);
  expect(await count()).toBe(0);
});
test('JSON malformado mantiene no-store y revisión requiere comando válido', async () => {
  const response = await fetch(baseUrl + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  expect(response.status).toBe(400);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const id = (await (await customer.request(endpoint, 'POST', input())).json()).request.requestId;
  expect((await clerk.request(endpoint + '/' + id + '/review', 'POST', {})).status).toBe(400);
});

const { createHash } = require('node:crypto');
const PgRequestRepository = require('../../../src/modules/bookings/infrastructure/pg-benefit-request.repository');
const createRequests = require('../../../src/modules/bookings/application/benefit-requests');
const purchaseCatalogFor = require('../../../src/modules/bookings/infrastructure/route-sheet-purchase-catalog');
const calendarDateAt = require('../../../src/modules/bookings/infrastructure/booking-clock');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const { createRouteSheetsModule } = require('../../../src/modules/route-sheets');
function reviewCommand() {
  return {
    expectedRevision: 1,
    decisions: [
      {
        seatId,
        birthDateVerified: true,
        disabilityVerified: true,
        evidence: [
          { kind: 'IDENTITY', reference: 'ref_identity_0001' },
          { kind: 'DISABILITY', reference: 'ref_disability_0001' },
        ],
      },
    ],
  };
}
async function pendingRequest() {
  const purchase = input();
  const response = await customer.request(endpoint, 'POST', purchase);
  expect(response.status).toBe(201);
  const id = (await response.json()).request.requestId;
  delete purchase.requestKey;
  return { id, purchase };
}
async function reviewCount() {
  return (await pool.query('SELECT count(*)::int n FROM booking_benefit_reviews')).rows[0].n;
}
// QA de fallos de persistencia: sesión interna sintética con usuario previamente verificado por Auth.
// La autorización HTTP se comprueba por separado; catálogo y SQL son reales.
function faultRequests(fault) {
  const pass = (_req, _res, next) => next();
  const auth = { authenticate: pass, authorize: () => pass, csrfProtection: pass };
  const fleet = createFleetModule({ pool, auth, env: {} });
  const frequencies = createFrequenciesModule({ pool, auth });
  const sheets = createRouteSheetsModule({
    pool,
    auth,
    frequencyQueries: frequencies.frequencyQueries,
    busGroupQueries: fleet.busGroupQueries,
    busQueries: fleet.busQueries,
    seatQueries: fleet.seatQueries,
  });
  const connection = {
    query: (...args) => pool.query(...args),
    connect: async () => {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        query: async (sql, args) => {
          if (fault === 'update' && sql.startsWith('UPDATE booking_benefit_requests'))
            throw Object.assign(new Error('fallo QA antes de guardar solicitud'), {
              code: 'XX000',
            });
          const result = await client.query(sql, args);
          if (fault === 'commit' && sql === 'COMMIT')
            throw Object.assign(new Error('respuesta QA perdida después de COMMIT'), {
              code: 'ECONNRESET',
            });
          return result;
        },
      };
    },
  };
  return createRequests({
    repository: new PgRequestRepository(connection),
    purchaseCatalog: purchaseCatalogFor({ tripQueries: sheets.tripQueries }),
    clock: () => new Date(),
    calendarDateAt,
    newId: randomUUID,
    fingerprint: (value) => createHash('sha256').update(value).digest('hex'),
  });
}
test('C: revisión real permite resumen con descuento sin dobles y conserva evidencia privada', async () => {
  const { id, purchase } = await pendingRequest();
  const initial = await customer.request('/api/v1/bookings/summary', 'POST', purchase);
  expect(initial.status).toBe(409);
  const response = await clerk.request(endpoint + '/' + id + '/review', 'POST', reviewCommand());
  expect(response.status).toBe(200);
  const result = (await response.json()).request;
  expect(result).toMatchObject({ status: 'REVIEWED', revision: 2 });
  expect(result.review.decisions[0].evidence).toHaveLength(2);
  const summary = await customer.request('/api/v1/bookings/summary', 'POST', purchase);
  expect(summary.status).toBe(200);
  expect((await summary.json()).summary.totals.totalPriceCents).toBe(225);
  const own = await (await customer.request(endpoint + '/' + id)).json();
  expect(own.request.review.decisions).toEqual([
    { seatId, birthDateVerified: true, disabilityVerified: true },
  ]);
  expect(JSON.stringify(own)).not.toMatch(
    /ref_identity|ref_disability|reviewedBy|benefitReviewId|0100000009/,
  );
  const queue = await (await clerk.request(endpoint)).json();
  expect(queue.requests[0].status).toBe('REVIEWED');
  expect(JSON.stringify(queue)).not.toMatch(/ref_identity|ref_disability|reviewedBy|0100000009/);
  const source = (await pool.query('SELECT decisions FROM booking_benefit_reviews')).rows[0]
    .decisions;
  expect(source).toEqual([{ seatId, birthDateVerified: true, disabilityVerified: true }]);
  expect(
    (
      await pool.query(
        'SELECT (SELECT count(*) FROM bookings)::int bookings,(SELECT count(*) FROM booking_seat_allocations)::int seats',
      )
    ).rows[0],
  ).toEqual({ bookings: 0, seats: 0 });
});
test('C: sesión, rol, cooperativa, CSRF y contenido cerrado protegen la revisión', async () => {
  const { id } = await pendingRequest();
  const path = endpoint + '/' + id + '/review';
  expect((await new Browser(baseUrl).request(path, 'POST', reviewCommand())).status).toBe(401);
  expect((await customer.request(path, 'POST', reviewCommand())).status).toBe(403);
  expect((await admin.request(path, 'POST', reviewCommand())).status).toBe(403);
  expect((await clerk.request(path, 'POST', reviewCommand(), '')).status).toBe(403);
  expect((await foreign.request(path, 'POST', reviewCommand())).status).toBe(404);
  expect(
    (await clerk.request(path, 'POST', { ...reviewCommand(), ownerId: randomUUID() })).status,
  ).toBe(400);
  const invalid = reviewCommand();
  invalid.decisions[0].evidence = [];
  expect((await clerk.request(path, 'POST', invalid)).status).toBe(400);
  expect(await reviewCount()).toBe(0);
});
test('C: dos envíos iguales simultáneos recuperan una sola revisión y otro contenido da conflicto', async () => {
  const { id } = await pendingRequest();
  const path = endpoint + '/' + id + '/review';
  const command = reviewCommand();
  const responses = await Promise.all([
    clerk.request(path, 'POST', command),
    clerk.request(path, 'POST', command),
  ]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  const results = await Promise.all(responses.map((r) => r.json()));
  expect(results[0].request.review).toEqual(results[1].request.review);
  expect(await reviewCount()).toBe(1);
  const before = await rows();
  command.decisions[0].evidence[0].reference = 'ref_different_0001';
  expect((await clerk.request(path, 'POST', command)).status).toBe(409);
  expect(await rows()).toEqual(before);
});
test('C: dos oficinistas no sobrescriben una revisión', async () => {
  const { id } = await pendingRequest();
  const hash = await (await createHasher()).hash(password);
  await pool.query(
    "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES('benefit-clerk2@example.ec',$1,'CLERK',$2)",
    [hash, owner.cooperativeId],
  );
  const second = new Browser(baseUrl);
  await second.login('benefit-clerk2@example.ec', password);
  const path = endpoint + '/' + id + '/review';
  const responses = await Promise.all([
    clerk.request(path, 'POST', reviewCommand()),
    second.request(path, 'POST', reviewCommand()),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await reviewCount()).toBe(1);
  const winner = responses[0].status === 200 ? clerk : second;
  const user = (await (await winner.request('/api/v1/auth/me')).json()).user;
  expect(
    (await pool.query('SELECT reviewed_by FROM booking_benefit_requests WHERE id=$1', [id])).rows[0]
      .reviewed_by,
  ).toBe(user.id);
});
test('C: verificación falsa se registra sin acreditar ni liberar reservas', async () => {
  const { id, purchase } = await pendingRequest();
  const command = {
    expectedRevision: 1,
    decisions: [{ seatId, birthDateVerified: false, disabilityVerified: false, evidence: [] }],
  };
  expect((await clerk.request(endpoint + '/' + id + '/review', 'POST', command)).status).toBe(200);
  const summary = await customer.request('/api/v1/bookings/summary', 'POST', purchase);
  expect(summary.status).toBe(409);
  expect((await summary.json()).error.code).toBe('BOOKING_BENEFIT_REVIEW_REQUIRED');
  expect(await reviewCount()).toBe(1);
});
test('C: fallo entre insertar acreditación y guardar resultado revierte todo', async () => {
  const { id } = await pendingRequest();
  const user = (await (await clerk.request('/api/v1/auth/me')).json()).user;
  const before = await rows();
  await expect(
    faultRequests('update').review(id, reviewCommand(), { sid: 'qa-verified-context', user }),
  ).rejects.toMatchObject({ httpStatus: 500 });
  expect(await rows()).toEqual(before);
  expect(await reviewCount()).toBe(0);
});
test('C: respuesta perdida después de COMMIT se recupera por HTTP sin duplicados', async () => {
  const { id } = await pendingRequest();
  const user = (await (await clerk.request('/api/v1/auth/me')).json()).user;
  await expect(
    faultRequests('commit').review(id, reviewCommand(), { sid: 'qa-verified-context', user }),
  ).rejects.toMatchObject({ code: 'BOOKING_BENEFIT_REVIEW_UNCERTAIN', httpStatus: 503 });
  expect(await reviewCount()).toBe(1);
  expect((await rows())[0].revision).toBe(2);
  const replay = await clerk.request(endpoint + '/' + id + '/review', 'POST', reviewCommand());
  expect(replay.status).toBe(200);
  expect((await replay.json()).request.revision).toBe(2);
  expect(await reviewCount()).toBe(1);
});
test('C: contexto y resultado revisado son inmutables en PostgreSQL', async () => {
  const { id } = await pendingRequest();
  await expect(
    pool.query(
      "UPDATE booking_benefit_requests SET expires_at=expires_at+interval '1 minute' WHERE id=$1",
      [id],
    ),
  ).rejects.toThrow('El contexto de la solicitud es inmutable');
  expect(
    (await clerk.request(endpoint + '/' + id + '/review', 'POST', reviewCommand())).status,
  ).toBe(200);
  const before = await rows();
  await expect(
    pool.query("UPDATE booking_benefit_requests SET review_decisions='[]' WHERE id=$1", [id]),
  ).rejects.toThrow('La revisión de acreditación es inmutable');
  await expect(
    pool.query('DELETE FROM booking_benefit_requests WHERE id=$1', [id]),
  ).rejects.toThrow('La revisión de acreditación es inmutable');
  expect(await rows()).toEqual(before);
});
