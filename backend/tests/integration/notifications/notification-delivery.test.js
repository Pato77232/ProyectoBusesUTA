const { randomUUID } = require('node:crypto');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createNotificationsModule } = require('../../../src/modules/notifications');
const { createBookingNotificationQueries } = require('../../../src/modules/bookings');
const { createCustomerContactQueries } = require('../../../src/modules/auth');
const PgBookingSaleConfirmer = require('../../../src/modules/bookings/infrastructure/pg-booking-sale-confirmer');
const PgNotificationDeliveryRepository = require('../../../src/modules/notifications/infrastructure/pg-notification-delivery.repository');
const createSendNotifications = require('../../../src/modules/notifications/application/send-notifications');
const { soldRowWithTrip } = require('../../helpers/sold-booking-ticket-trip');

const bookingId = 'venta-opaca/qa';
const T0 = new Date('2026-11-05T12:00:00.000Z');
const config = {
  origin: 'https://transviaje.example',
  claimMs: 120000,
  batchSize: 10,
  maxAttempts: 3,
  delays: [1, 5],
};
let pool, now, mailer, customerId;

async function clear() {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE email_notifications, booking_seat_allocations, bookings, booking_trip_locks, auth_sessions, users CASCADE',
  );
}

async function seedSale(ownerId) {
  const row = soldRowWithTrip();
  await pool.query("INSERT INTO booking_trip_locks VALUES('coop-ticket','trip-ticket')");
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
    base_price_cents,discount_cents,total_price_cents,created_at,expires_at,
    proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at)
    VALUES($1,'coop-ticket','trip-ticket',$2,0,1,'PENDING_PAYMENT',$3,
    1000,0,1000,'2026-11-04T14:00:00Z','2026-11-04T14:05:00Z',
    '2026-11-04T14:00:00Z',300,'RECEIVED','proof-ticket','2026-11-04T14:01:00Z')`,
    [bookingId, ownerId, row.summary],
  );
  for (const p of row.summary.passengers)
    await pool.query(
      `INSERT INTO booking_seat_allocations VALUES($1,'coop-ticket','trip-ticket',$2,0,1,'RESERVED',true)`,
      [bookingId, p.seatId],
    );
  await new PgBookingSaleConfirmer({ pool, clock: () => T0 }).confirmSale({
    bookingId,
    cooperativeId: 'coop-ticket',
    paymentProofId: 'proof-ticket',
  });
  const client = await pool.connect();
  try {
    await createNotificationsModule({ clock: () => T0 }).outbox.enqueueWith(client, {
      kind: 'TICKETS_READY',
      bookingId,
      cooperativeId: 'coop-ticket',
    });
  } finally {
    client.release();
  }
}

function sender() {
  return createSendNotifications({
    repository: new PgNotificationDeliveryRepository({ pool }),
    bookingContexts: createBookingNotificationQueries({ pool }),
    customerContacts: createCustomerContactQueries({ pool }),
    mailer,
    config,
    clock: () => now,
  });
}

const notice = async () => (await pool.query('SELECT * FROM email_notifications')).rows[0];
const at = (minutes) => new Date(T0.getTime() + minutes * 60000);

beforeAll(() => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
});
beforeEach(async () => {
  await clear();
  now = T0;
  mailer = { send: jest.fn(async () => ({ status: 'ACCEPTED' })) };
  customerId = randomUUID();
  await pool.query(
    `INSERT INTO users (id,email,password_hash,role) VALUES ($1,'cliente.aviso@example.ec','hash-no-usado','CUSTOMER')`,
    [customerId],
  );
});
afterAll(async () => {
  if (pool) {
    await clear();
    await pool.end();
  }
});

test('una venta aprobada se envía una sola vez al correo del comprador', async () => {
  await seedSale(customerId);
  await sender().runBatch();
  expect(mailer.send).toHaveBeenCalledTimes(1);
  const sent = mailer.send.mock.calls[0][0];
  expect(sent.to).toBe('cliente.aviso@example.ec');
  expect(sent.text).toContain(
    `https://transviaje.example/pages/boletos.html?reserva=${encodeURIComponent(bookingId)}`,
  );
  expect(sent.text).not.toContain('1710034065');
  expect(await notice()).toMatchObject({
    state: 'ACCEPTED',
    attempts: 1,
    claimed_at: null,
    last_error_code: null,
    finished_at: T0,
  });
  expect(sent.notificationId).toBe((await notice()).id);
  await sender().runBatch();
  expect(mailer.send).toHaveBeenCalledTimes(1);
});

test('un fallo temporal espera la demora configurada y luego reintenta', async () => {
  await seedSale(customerId);
  mailer.send.mockRejectedValueOnce(
    Object.assign(new Error('x'), { code: 'MAIL_TEMPORARY_FAILURE' }),
  );
  await sender().processNext();
  expect(await notice()).toMatchObject({
    state: 'PENDING',
    attempts: 1,
    last_error_code: 'MAIL_TEMPORARY_FAILURE',
    next_attempt_at: at(1),
    claimed_at: null,
  });
  now = new Date(at(1).getTime() - 1);
  await expect(sender().processNext()).resolves.toBe(false);
  now = at(1);
  await sender().processNext();
  expect(await notice()).toMatchObject({ state: 'ACCEPTED', attempts: 2 });
});

test('un reclamo abandonado se recupera tras el plazo de reclamo', async () => {
  await seedSale(customerId);
  const repository = new PgNotificationDeliveryRepository({ pool });
  const abandoned = await repository.claimNext({ now: T0, claimMs: config.claimMs });
  expect(abandoned.attempts).toBe(1);
  now = new Date(T0.getTime() + config.claimMs - 1);
  await expect(sender().processNext()).resolves.toBe(false);
  now = new Date(T0.getTime() + config.claimMs);
  await sender().processNext();
  expect(await notice()).toMatchObject({ state: 'ACCEPTED', attempts: 2 });
  await expect(
    repository.finish({ id: abandoned.id, attempts: 1, state: 'FAILED', code: 'X', now }),
  ).resolves.toBe(false);
  expect((await notice()).state).toBe('ACCEPTED');
});

test('dos trabajadores a la vez no reclaman el mismo aviso', async () => {
  await seedSale(customerId);
  const repository = new PgNotificationDeliveryRepository({ pool });
  const claims = await Promise.all(
    Array.from({ length: 5 }, () => repository.claimNext({ now: T0, claimMs: config.claimMs })),
  );
  expect(claims.filter(Boolean)).toHaveLength(1);
});

test('una reserva de invitado o sin cliente se omite sin enviar', async () => {
  await seedSale('token-de-invitado');
  await sender().processNext();
  expect(mailer.send).not.toHaveBeenCalled();
  expect(await notice()).toMatchObject({ state: 'SKIPPED', last_error_code: 'NO_CUSTOMER_EMAIL' });
});
