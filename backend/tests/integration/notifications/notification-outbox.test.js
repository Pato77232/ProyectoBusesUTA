const { randomUUID } = require('node:crypto');
const { runMigration, testPool } = require('../../helpers/database');
const { rollbackBefore } = require('../../helpers/migration-target');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createNotificationsModule } = require('../../../src/modules/notifications');
const { createBookingNotificationQueries } = require('../../../src/modules/bookings');
const { createCustomerContactQueries } = require('../../../src/modules/auth');
const { OWNER_ID, soldRowWithTrip } = require('../../helpers/sold-booking-ticket-trip');

const NOW = new Date('2026-11-05T12:00:00.000Z');
const notice = { kind: 'TICKETS_READY', bookingId: 'venta-aviso', cooperativeId: 'coop-aviso' };
let pool, outbox;

async function clear() {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE email_notifications, booking_seat_allocations, bookings, booking_trip_locks, auth_sessions, users CASCADE',
  );
}

async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const stored = async () =>
  (await pool.query('SELECT * FROM email_notifications ORDER BY kind')).rows;

beforeAll(() => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  outbox = createNotificationsModule({ clock: () => NOW }).outbox;
});
beforeEach(clear);
afterAll(async () => {
  if (pool) {
    await clear();
    await pool.end();
  }
});

test('el aviso se confirma con la transacción que lo encola', async () => {
  await inTransaction((client) => outbox.enqueueWith(client, notice));
  const [row] = await stored();
  expect(row).toMatchObject({
    kind: 'TICKETS_READY',
    booking_id: 'venta-aviso',
    cooperative_id: 'coop-aviso',
    payload: {},
    state: 'PENDING',
    attempts: 0,
    claimed_at: null,
    finished_at: null,
  });
  expect(row.next_attempt_at).toEqual(NOW);
});

test('si la transacción se revierte, el aviso desaparece con ella', async () => {
  await expect(
    inTransaction(async (client) => {
      await outbox.enqueueWith(client, notice);
      throw new Error('falla la aprobación');
    }),
  ).rejects.toThrow('falla la aprobación');
  expect(await stored()).toEqual([]);
});

test('un aviso por tipo y reserva: repetir no duplica', async () => {
  const first = await inTransaction((client) => outbox.enqueueWith(client, notice));
  const again = await inTransaction((client) => outbox.enqueueWith(client, notice));
  await inTransaction((client) =>
    outbox.enqueueWith(client, { ...notice, kind: 'PROOF_REJECTED', justification: 'Ilegible' }),
  );
  expect([first.queued, again.queued]).toEqual([true, false]);
  expect((await stored()).map((r) => [r.kind, r.payload])).toEqual([
    ['PROOF_REJECTED', { justification: 'Ilegible' }],
    ['TICKETS_READY', {}],
  ]);
});

test('la base rechaza estados incoherentes', async () => {
  const insert = (state, claimed, finished) =>
    pool.query(
      `INSERT INTO email_notifications (id,kind,booking_id,cooperative_id,state,next_attempt_at,created_at,claimed_at,finished_at)
       VALUES ($1,'BOOKING_EXPIRED',$2,'c',$3,now(),now(),$4,$5)`,
      [randomUUID(), randomUUID(), state, claimed, finished],
    );
  await expect(insert('SENDING', null, null)).rejects.toMatchObject({ code: '23514' });
  await expect(insert('ACCEPTED', null, null)).rejects.toMatchObject({ code: '23514' });
  await expect(insert('OTRO', null, null)).rejects.toMatchObject({ code: '23514' });
  await expect(insert('SENDING', new Date(), null)).resolves.toBeDefined();
});

test('Reservas entrega el contexto del aviso y Auth el correo del cliente', async () => {
  const customerId = randomUUID();
  await pool.query(
    `INSERT INTO users (id,email,password_hash,role) VALUES ($1,'cliente.aviso@example.ec','hash-no-usado','CUSTOMER')`,
    [customerId],
  );
  const row = soldRowWithTrip();
  await pool.query("INSERT INTO booking_trip_locks VALUES('coop-ticket','trip-ticket')");
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
    base_price_cents,discount_cents,total_price_cents,created_at,expires_at,
    proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at)
    VALUES($1,'coop-ticket','trip-ticket',$2,0,1,'PENDING_PAYMENT',$3,
    1000,0,1000,'2026-11-04T14:00:00Z','2026-11-04T14:05:00Z',
    '2026-11-04T14:00:00Z',300,'RECEIVED','proof-ticket','2026-11-04T14:01:00Z')`,
    [row.bookingId, customerId, row.summary],
  );
  const context = await createBookingNotificationQueries({ pool }).findNotificationContext({
    bookingId: row.bookingId,
    cooperativeId: 'coop-ticket',
  });
  expect(context).toMatchObject({
    ownerId: customerId,
    status: 'PENDING_PAYMENT',
    trip: { origin: { locationKey: 'Ambato' } },
    passengers: [{ fullName: 'Pasajera QA Uno' }, { fullName: 'Pasajero QA Dos' }],
  });
  expect(JSON.stringify(context)).not.toContain('1710034065');
  const contacts = createCustomerContactQueries({ pool });
  await expect(contacts.findCustomerEmail(context.ownerId)).resolves.toBe(
    'cliente.aviso@example.ec',
  );
  await expect(contacts.findCustomerEmail(randomUUID())).resolves.toBeNull();
  await expect(contacts.findCustomerEmail(OWNER_ID)).resolves.toBeNull();
});

test('la reversión de la migración se bloquea con avisos registrados', async () => {
  await inTransaction((client) => outbox.enqueueWith(client, notice));
  await rollbackBefore(pool, '1794340000000-create-email-notifications');
  expect(() => runMigration('down')).toThrow();
  expect(await stored()).toHaveLength(1);
  await pool.query('TRUNCATE email_notifications');
  runMigration('down');
  expect(
    (await pool.query("SELECT to_regclass('public.email_notifications') AS t")).rows[0].t,
  ).toBeNull();
  runMigration();
});
