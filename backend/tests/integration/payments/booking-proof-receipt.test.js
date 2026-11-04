const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createBookingsModule } = require('../../../src/modules/bookings');
const { createPaymentReceiptModule } = require('../../../src/modules/payments');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const PgProofRepository = require('../../../src/modules/payments/infrastructure/pg-payment-proof.repository');
const FileStorage = require('../../../src/modules/payments/infrastructure/local-private-file-storage');
const QueryAdapter = require('../../../src/modules/payments/infrastructure/bookings-payment-query-adapter');
const UploadPaymentProof = require('../../../src/modules/payments/application/upload-payment-proof.use-case');
const {
  summaryInput,
  summaryContext,
} = require('../../unit/bookings/helpers/booking-summary-fixtures');
const start = new Date('2026-11-03T14:00:00.000Z');
const before = new Date('2026-11-03T14:04:59.999Z');
const deadline = new Date('2026-11-03T14:05:00.000Z');
const after = new Date('2026-11-03T14:06:00.000Z');
const pass = (_req, _res, next) => next();
const auth = { authenticate: pass, authorize: () => pass, csrfProtection: pass };
const file = { buffer: Buffer.from('%PDF-1.4\nQA'), originalFileName: 'recibo.pdf' };
let pool, directory, booking, proofRepository, fileStorage, bookings, bridge, now;
beforeAll(() => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE payment_proof_notification_outbox,payment_proofs,booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
  );
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'receipt-bridge-'));
  fileStorage = new FileStorage({ rootDirectory: directory });
  proofRepository = new PgProofRepository(pool);
  const base = summaryContext();
  const context = {
    ...base,
    bookingId: randomUUID(),
    ownerId: randomUUID(),
    startedAt: start,
    proofWindowSeconds: 300,
    trip: { ...base.trip, cooperativeId: randomUUID() },
  };
  const repository = new PgBookingRepository({ pool });
  booking = await repository.reserve(
    { tripId: context.trip.tripId, cooperativeId: context.trip.cooperativeId },
    async () => ({ input: { ...summaryInput(), summaryAccepted: true }, context }),
  );
  now = before;
  bookings = createBookingsModule({ pool, auth, clock: () => new Date(now) });
  bridge = createPaymentReceiptModule({
    pool,
    createPaymentProofReceiver: bookings.createPaymentProofReceiver,
  });
});
afterEach(async () => {
  for (const name of await fs.readdir(directory)) await fs.unlink(path.join(directory, name));
  await fs.rmdir(directory);
});
afterAll(async () => {
  if (pool) await pool.end();
});

function uploader(notifier = bridge.bookingPaymentProofNotifier) {
  const query = new QueryAdapter({ paymentQueries: bookings.paymentQueries });
  // Contexto interno exclusivamente de QA; no acredita una ruta autenticada de carga.
  const context = { userId: booking.ownerId, role: 'CUSTOMER', cooperativeId: null };
  return new UploadPaymentProof({
    bookingReader: {
      findForPayment: (bookingId) =>
        query.findForPayment({ bookingId, purpose: 'UPLOAD_PROOF' }, context),
    },
    fileStorage,
    paymentProofRepository: proofRepository,
    bookingPaymentProofNotifier: notifier,
  });
}
function upload(useCase = uploader()) {
  return useCase.execute({
    bookingId: booking.bookingId,
    customerId: booking.ownerId,
    file,
    now: before,
  });
}
async function snapshot() {
  return {
    proofs: (await pool.query('SELECT * FROM payment_proofs ORDER BY id')).rows,
    outbox: (await pool.query('SELECT * FROM payment_proof_notification_outbox ORDER BY id')).rows,
    receipts: (
      await pool.query('SELECT * FROM booking_proof_receipt_results ORDER BY payment_proof_id')
    ).rows,
    bookings: (await pool.query('SELECT * FROM bookings ORDER BY id')).rows,
    seats: (await pool.query('SELECT * FROM booking_seat_allocations ORDER BY seat_id')).rows,
    files: await fs.readdir(directory),
  };
}
async function pendingProof() {
  await expect(
    upload(
      uploader({
        async markPaymentProofReceived() {
          throw new Error('Aviso no enviado');
        },
      }),
    ),
  ).rejects.toMatchObject({ code: 'BOOKING_NOTIFICATION_UNCERTAIN' });
  return (await snapshot()).proofs[0];
}
const target = (proof) => ({
  bookingId: proof.booking_id,
  cooperativeId: proof.cooperative_id,
  paymentProofId: proof.id,
});

test('carga con lector real y fuente persistida conserva asientos y entrega el aviso', async () => {
  const result = await upload();
  const stored = await snapshot();
  expect(stored.proofs).toHaveLength(1);
  expect(stored.outbox[0].status).toBe('DELIVERED');
  expect(stored.receipts[0].outcome).toBe('ACCEPTED');
  expect(stored.bookings[0].proof_reception_state).toBe('RECEIVED');
  expect(stored.seats.every((seat) => seat.active && seat.status === 'RESERVED')).toBe(true);
  expect(await fileStorage.read(result.paymentProof.file_key)).toEqual(file.buffer);
  const source = await bridge.paymentProofQueries.findForBookingReceipt({
    paymentProofId: result.paymentProof.id,
  });
  expect(source).toEqual({
    ...target(result.paymentProof),
    status: 'UPLOADED',
    notificationStatus: 'DELIVERED',
    uploadedAt: before.toISOString(),
  });
  expect(Object.isFrozen(source)).toBe(true);
});
test('replay tras el plazo y DELIVERED recupera la misma aceptación sin nueva sesión', async () => {
  const result = await upload();
  const stored = await snapshot();
  now = after;
  const restarted = createPaymentReceiptModule({
    pool,
    createPaymentProofReceiver: createBookingsModule({ pool, auth, clock: () => after })
      .createPaymentProofReceiver,
  });
  await expect(
    restarted.bookingPaymentProofNotifier.markPaymentProofReceived(target(result.paymentProof)),
  ).resolves.toBeUndefined();
  expect(await snapshot()).toEqual(stored);
});
test('vencimiento confirmado compensa comprobante/archivo y conserva rechazo durable', async () => {
  now = deadline;
  // El lector se evaluó antes del plazo; el reloj de recepción avanza al invocarlo.
  const queryBookings = createBookingsModule({ pool, auth, clock: () => before });
  const adapter = new QueryAdapter({ paymentQueries: queryBookings.paymentQueries });
  const useCase = uploader();
  useCase.bookingReader = {
    findForPayment: (bookingId) =>
      adapter.findForPayment(
        { bookingId, purpose: 'UPLOAD_PROOF' },
        { userId: booking.ownerId, role: 'CUSTOMER', cooperativeId: null },
      ),
  };
  await expect(upload(useCase)).rejects.toMatchObject({
    code: 'PAYMENT_PROOF_UPLOAD_DEADLINE_EXPIRED',
  });
  const stored = await snapshot();
  expect(stored.proofs).toHaveLength(0);
  expect(stored.outbox).toHaveLength(0);
  expect(stored.files).toHaveLength(0);
  expect(stored.receipts[0].outcome).toBe('REJECTED_EXPIRED');
  expect(stored.bookings[0].status).toBe('EXPIRED');
  expect(stored.seats.every((seat) => !seat.active)).toBe(true);
});
test('respuesta perdida después de COMMIT conserva evidencia y el reintento entrega', async () => {
  let lost = false;
  const lostPool = {
    query: pool.query.bind(pool),
    async connect() {
      const client = await pool.connect();
      return {
        release: (error) => client.release(error),
        async query(...args) {
          const result = await client.query(...args);
          if (args[0] === 'COMMIT' && !lost) {
            lost = true;
            throw new Error('Respuesta perdida QA');
          }
          return result;
        },
      };
    },
  };
  const receiver = createBookingsModule({ pool: lostPool, auth, clock: () => before });
  const uncertain = createPaymentReceiptModule({
    pool,
    createPaymentProofReceiver: receiver.createPaymentProofReceiver,
  });
  await expect(upload(uploader(uncertain.bookingPaymentProofNotifier))).rejects.toMatchObject({
    code: 'BOOKING_NOTIFICATION_UNCERTAIN',
  });
  const stored = await snapshot();
  expect(stored.proofs).toHaveLength(1);
  expect(stored.files).toHaveLength(1);
  expect(stored.outbox[0].status).toBe('PENDING');
  expect(stored.receipts[0].outcome).toBe('ACCEPTED');
  now = after;
  await expect(upload()).resolves.toHaveProperty('paymentProof.id', stored.proofs[0].id);
  const recovered = await snapshot();
  expect(recovered.receipts).toEqual(stored.receipts);
  expect(recovered.files).toEqual(stored.files);
  expect(recovered.outbox[0].status).toBe('DELIVERED');
});
test('fallo al marcar entregado mantiene aceptación y permite reintento', async () => {
  const useCase = uploader();
  useCase.paymentProofRepository = Object.create(proofRepository);
  useCase.paymentProofRepository.markNotificationDelivered = async () => {
    throw new Error('Fallo local QA');
  };
  await expect(upload(useCase)).rejects.toMatchObject({ code: 'BOOKING_NOTIFICATION_UNCERTAIN' });
  const stored = await snapshot();
  expect(stored.receipts).toHaveLength(1);
  expect(stored.outbox[0].status).toBe('PENDING');
  now = after;
  await expect(upload()).resolves.toHaveProperty('paymentProof.id', stored.proofs[0].id);
  expect((await snapshot()).outbox[0].status).toBe('DELIVERED');
});
test.each(['missing-outbox', 'wrong-booking', 'wrong-tenant'])(
  'fuente %s no acepta ni borra evidencia',
  async (kind) => {
    const proof = await pendingProof();
    if (kind === 'missing-outbox')
      await pool.query('DELETE FROM payment_proof_notification_outbox');
    if (kind === 'wrong-booking')
      await pool.query('UPDATE payment_proof_notification_outbox SET booking_id=$1', [
        randomUUID(),
      ]);
    if (kind === 'wrong-tenant')
      await pool.query('UPDATE payment_proofs SET cooperative_id=$1', [randomUUID()]);
    const stored = await snapshot();
    await expect(
      bridge.bookingPaymentProofNotifier.markPaymentProofReceived(target(proof)),
    ).rejects.toMatchObject({ code: 'BOOKING_NOTIFICATION_UNCERTAIN' });
    expect(await snapshot()).toEqual(stored);
  },
);
test('consulta pública no sustituye fallos técnicos por ausencia', async () => {
  const failed = createPaymentReceiptModule({
    pool: {
      query: async () => {
        throw new Error('SQL privado');
      },
    },
    createPaymentProofReceiver: bookings.createPaymentProofReceiver,
  });
  await expect(
    failed.paymentProofQueries.findForBookingReceipt({ paymentProofId: randomUUID() }),
  ).rejects.toMatchObject({ code: 'BOOKING_NOTIFICATION_UNCERTAIN' });
  await expect(
    bridge.paymentProofQueries.findForBookingReceipt({ paymentProofId: randomUUID() }),
  ).resolves.toBeNull();
});

test('puente persistido conserva bookingId opaco sin exigir UUID', async () => {
  const id = "reserva QA/á:01'";
  try {
    await pool.query('DELETE FROM bookings WHERE id=$1', [booking.bookingId]);
    const base = summaryContext();
    const context = {
      ...base,
      bookingId: id,
      ownerId: booking.ownerId,
      startedAt: start,
      proofWindowSeconds: 300,
      trip: { ...base.trip, cooperativeId: booking.summary.cooperativeId },
    };
    booking = await new PgBookingRepository({ pool }).reserve(
      { tripId: context.trip.tripId, cooperativeId: context.trip.cooperativeId },
      async () => ({ input: { ...summaryInput(), summaryAccepted: true }, context }),
    );
    const result = await upload();
    const stored = await snapshot();
    expect(result.paymentProof.booking_id).toBe(id);
    expect(stored.proofs[0].booking_id).toBe(id);
    expect(stored.outbox[0].booking_id).toBe(id);
    expect(stored.outbox[0].status).toBe('DELIVERED');
    expect(stored.receipts[0].booking_id).toBe(id);
    expect(stored.receipts[0].outcome).toBe('ACCEPTED');
    expect(stored.seats.every((seat) => seat.active && seat.status === 'RESERVED')).toBe(true);
    expect(
      (
        await bridge.paymentProofQueries.findForBookingReceipt({
          paymentProofId: result.paymentProof.id,
        })
      ).bookingId,
    ).toBe(id);
    expect(await fileStorage.read(result.paymentProof.file_key)).toEqual(file.buffer);
  } finally {
    await proofRepository.deleteByBookingId(id);
    await pool.query('DELETE FROM booking_proof_receipt_results WHERE booking_id=$1', [id]);
    await pool.query('DELETE FROM bookings WHERE id=$1', [id]);
  }
});

test('receptor y outbox recuperan el mismo aviso de una identidad con espacios externos', async () => {
  const id = "  Reserva/á:01'  ";
  // Identidad persistida externa de QA: el generador actual de altas produce UUID.
  await pool.query(
    `INSERT INTO bookings SELECT (jsonb_populate_record(NULL::bookings,
    to_jsonb(b) || jsonb_build_object('id',$2::text))).* FROM bookings b WHERE id=$1`,
    [booking.bookingId, id],
  );
  await pool.query(
    `INSERT INTO booking_seat_allocations SELECT $2,cooperative_id,trip_id,seat_id,from_position,to_position,status,active FROM booking_seat_allocations WHERE booking_id=$1`,
    [booking.bookingId, id],
  );
  await pool.query('DELETE FROM bookings WHERE id=$1', [booking.bookingId]);
  booking = { ...booking, bookingId: id };
  try {
    // Se prueba el puerto persistido con datos QA; no la carga legada que recorta su entrada.
    const {
      createPaymentProof,
      uploadPaymentProof,
    } = require('../../../src/modules/payments/domain/payment-proof');
    const proof = await proofRepository.saveWithPendingNotification(
      uploadPaymentProof(
        createPaymentProof({ booking_id: id, cooperative_id: booking.summary.cooperativeId }),
        {
          file_key: 'qa-exact-identity',
          original_file_name: 'qa.pdf',
          media_type: 'application/pdf',
          file_size_bytes: 16,
        },
        deadline,
        before,
      ),
    );
    expect(proof.booking_id).toBe(id);
    expect(
      (await bridge.paymentProofQueries.findForBookingReceipt({ paymentProofId: proof.id }))
        .bookingId,
    ).toBe(id);
    await bridge.bookingPaymentProofNotifier.markPaymentProofReceived(target(proof));
    await proofRepository.markNotificationDelivered(id);
    const stored = await snapshot();
    now = after;
    const restarted = createPaymentReceiptModule({
      pool,
      createPaymentProofReceiver: createBookingsModule({ pool, auth, clock: () => after })
        .createPaymentProofReceiver,
    });
    await expect(
      restarted.bookingPaymentProofNotifier.markPaymentProofReceived(target(proof)),
    ).resolves.toBeUndefined();
    expect(await snapshot()).toEqual(stored);
    expect(stored.proofs[0].booking_id).toBe(id);
    expect(stored.outbox[0]).toMatchObject({ booking_id: id, status: 'DELIVERED' });
    expect(stored.receipts[0]).toMatchObject({ booking_id: id, outcome: 'ACCEPTED' });
    expect(stored.bookings[0]).toMatchObject({ id, proof_reception_state: 'RECEIVED' });
    expect(stored.seats.every((seat) => seat.active)).toBe(true);
  } finally {
    await proofRepository.deleteByBookingId(id);
    await pool.query('DELETE FROM booking_proof_receipt_results WHERE booking_id=$1', [id]);
    await pool.query('DELETE FROM bookings WHERE id=$1', [id]);
  }
});
