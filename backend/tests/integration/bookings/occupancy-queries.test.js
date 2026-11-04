const { randomUUID } = require('node:crypto');
const { createBookingOccupancyQueries } = require('../../../src/modules/bookings');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');

let pool, queries, cooperativeId, tripId;
beforeAll(() => {
  runMigration();
  pool = testPool();
  queries = createBookingOccupancyQueries({ pool });
});
beforeEach(() => {
  cooperativeId = randomUUID();
  tripId = randomUUID();
});
afterAll(async () => {
  await pool?.end();
});

async function occupy({ status = 'RESERVED', active = true, received = false } = {}) {
  assertTestDatabase();
  const bookingId = randomUUID();
  await pool.query(
    'INSERT INTO booking_trip_locks(cooperative_id,trip_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [cooperativeId, tripId],
  );
  // Datos sintéticos: prueban lectura, no certifican reserva ni venta productiva.
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,base_price_cents,discount_cents,total_price_cents,created_at,expires_at,proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at)
    VALUES($1,$2,$3,'ocupaciones-qa',0,1,'PENDING_PAYMENT','{}',100,0,100,'2026-11-03T14:00:00Z','2026-11-03T14:05:00Z',$4,$5,$6,$7,$8)`,
    [
      bookingId,
      cooperativeId,
      tripId,
      received ? '2026-11-03T14:00:00Z' : null,
      received ? 300 : null,
      received ? 'RECEIVED' : 'UNKNOWN',
      received ? randomUUID() : null,
      received ? '2026-11-03T14:01:00Z' : null,
    ],
  );
  await pool.query('INSERT INTO booking_seat_allocations VALUES($1,$2,$3,$4,0,1,$5,$6)', [
    bookingId,
    cooperativeId,
    tripId,
    randomUUID(),
    status,
    active,
  ]);
}
const read = (changes = {}) =>
  queries.hasActiveOccupations({ tripIds: [tripId], cooperativeId, ...changes });
test.each(['RESERVED', 'SOLD'])('cuenta %s activo aunque el plazo ya pasó', async (status) => {
  await occupy({ status });
  expect(await read()).toBe(true);
});
test('incluye comprobante recibido en revisión', async () => {
  await occupy({ received: true });
  expect(await read()).toBe(true);
});
test('excluye ocupación liberada', async () => {
  await occupy({ active: false });
  expect(await read()).toBe(false);
});
test('aísla cooperativa y viaje, incluidos varios viajes', async () => {
  await occupy();
  expect(await read({ cooperativeId: randomUUID() })).toBe(false);
  expect(await read({ tripIds: [randomUUID()] })).toBe(false);
  expect(await read({ tripIds: [randomUUID(), tripId] })).toBe(true);
});
