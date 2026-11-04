const PgBookingSaleConfirmer = require('../../../src/modules/bookings/infrastructure/pg-booking-sale-confirmer');

function fixture(row) {
  const queries = [];
  const client = {
    query: jest.fn(async (sql, params) => {
      queries.push({ sql, params });
      if (sql.startsWith('SELECT id,cooperative_id')) return { rows: [row] };
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  return { queries, client, pool: { connect: jest.fn(async () => client) } };
}

const now = new Date('2026-11-04T15:00:00.000Z');

test('confirma una reserva recibida, convierte sus asientos y es idempotente', async () => {
  const f = fixture({
    id: 'booking-1',
    cooperative_id: 'coop-1',
    status: 'PENDING_PAYMENT',
    proof_reception_state: 'RECEIVED',
    accepted_proof_id: 'proof-1',
  });
  const confirmer = new PgBookingSaleConfirmer({ pool: f.pool, clock: () => now });

  await expect(
    confirmer.confirmSale({
      bookingId: 'booking-1',
      cooperativeId: 'coop-1',
      paymentProofId: 'proof-1',
    }),
  ).resolves.toBe(true);
  expect(f.queries.some(({ sql }) => sql.includes("SET status='SOLD'"))).toBe(true);
  expect(f.queries.some(({ sql }) => sql.includes("SET status='SOLD',sold_at"))).toBe(true);

  const repeat = fixture({
    id: 'booking-1',
    cooperative_id: 'coop-1',
    status: 'SOLD',
    proof_reception_state: 'RECEIVED',
    accepted_proof_id: 'proof-1',
  });
  await expect(
    new PgBookingSaleConfirmer({ pool: repeat.pool, clock: () => now }).confirmSale({
      bookingId: 'booking-1',
      cooperativeId: 'coop-1',
      paymentProofId: 'proof-1',
    }),
  ).resolves.toBe(true);
  expect(repeat.queries.filter(({ sql }) => sql.includes("SET status='SOLD'")).length).toBe(0);
});

test.each([
  { status: 'PENDING_PAYMENT', proof_reception_state: 'NOT_RECEIVED', accepted_proof_id: null },
  { status: 'EXPIRED', proof_reception_state: 'RECEIVED', accepted_proof_id: 'proof-1' },
  { status: 'PENDING_PAYMENT', proof_reception_state: 'RECEIVED', accepted_proof_id: 'other' },
])('rechaza venta si el estado o vínculo no permite confirmarla: $status', async (row) => {
  const f = fixture({ id: 'booking-1', cooperative_id: 'coop-1', ...row });
  const confirmer = new PgBookingSaleConfirmer({ pool: f.pool, clock: () => now });
  await expect(
    confirmer.confirmSale({
      bookingId: 'booking-1',
      cooperativeId: 'coop-1',
      paymentProofId: 'proof-1',
    }),
  ).rejects.toMatchObject({ code: 'BOOKING_SALE_REJECTED' });
});

test('convierte un fallo de persistencia en resultado incierto y libera el cliente', async () => {
  const client = {
    query: jest.fn(async (sql) => {
      if (sql.startsWith('SELECT id,cooperative_id')) {
        return {
          rows: [
            {
              id: 'booking-1',
              cooperative_id: 'coop-1',
              status: 'PENDING_PAYMENT',
              proof_reception_state: 'RECEIVED',
              accepted_proof_id: 'proof-1',
            },
          ],
        };
      }
      if (sql.startsWith("UPDATE booking_seat_allocations")) throw new Error('connection lost');
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  const confirmer = new PgBookingSaleConfirmer({
    pool: { connect: jest.fn(async () => client) },
    clock: () => now,
  });
  await expect(
    confirmer.confirmSale({
      bookingId: 'booking-1',
      cooperativeId: 'coop-1',
      paymentProofId: 'proof-1',
    }),
  ).rejects.toMatchObject({ code: 'BOOKING_SALE_UNCERTAIN' });
  expect(client.release).toHaveBeenCalledTimes(1);
});
