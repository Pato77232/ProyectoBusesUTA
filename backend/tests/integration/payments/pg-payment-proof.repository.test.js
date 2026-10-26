const { randomUUID } = require('node:crypto');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const PgPaymentProofRepository = require('../../../src/modules/payments/infrastructure/pg-payment-proof.repository');
const {
  createPaymentProof,
  uploadPaymentProof,
} = require('../../../src/modules/payments/domain/payment-proof');

let pool;
let repository;
let cooperativeId;

function anyRuc() {
  return randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7');
}

async function createCooperative() {
  const { rows } = await pool.query(
    'INSERT INTO cooperatives(name, ruc) VALUES ($1, $2) RETURNING id',
    ['Cooperativa de pagos', anyRuc()],
  );
  return rows[0].id;
}

function createAwaiting(bookingId = randomUUID()) {
  return createPaymentProof({ booking_id: bookingId, cooperative_id: cooperativeId });
}

function createUploaded(bookingId = randomUUID(), fileKey = 'private/proof-1') {
  const awaiting = createAwaiting(bookingId);
  const uploadedAt = new Date('2026-10-25T14:00:00.000Z');
  return uploadPaymentProof(
    awaiting,
    {
      file_key: fileKey,
      original_file_name: 'transferencia.pdf',
      media_type: 'application/pdf',
      file_size_bytes: 1024,
    },
    new Date('2026-10-25T14:05:00.000Z'),
    uploadedAt,
  );
}

async function insertRawProof({
  bookingId = randomUUID(),
  status = 'AWAITING_UPLOAD',
  fileKey = null,
  originalFileName = null,
  mediaType = null,
  fileSizeBytes = null,
  uploadedAt = null,
  expiredAt = null,
} = {}) {
  return pool.query(
    `INSERT INTO payment_proofs(
      booking_id, cooperative_id, status, file_key, original_file_name,
      media_type, file_size_bytes, uploaded_at, expired_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      bookingId,
      cooperativeId,
      status,
      fileKey,
      originalFileName,
      mediaType,
      fileSizeBytes,
      uploadedAt,
      expiredAt,
    ],
  );
}

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgPaymentProofRepository(pool);
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE payment_proofs');
  cooperativeId = await createCooperative();
});

afterAll(async () => {
  if (pool) await pool.end();
});

test('la migración crea payment_proofs sin duplicar plazo ni total', async () => {
  // Arrange / Act
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'payment_proofs' ORDER BY ordinal_position`,
  );

  // Assert
  expect(rows.map(({ column_name }) => column_name)).toEqual([
    'id',
    'booking_id',
    'cooperative_id',
    'status',
    'file_key',
    'original_file_name',
    'media_type',
    'file_size_bytes',
    'uploaded_at',
    'expired_at',
    'created_at',
    'updated_at',
  ]);
  const { rows: indexRows } = await pool.query(
    `SELECT indexdef FROM pg_indexes WHERE tablename = 'payment_proofs'
     AND indexname = 'payment_proofs_status_booking_id_idx'`,
  );
  expect(indexRows[0].indexdef).toContain('(status, booking_id)');
  const { rows: bookingForeignKeys } = await pool.query(
    `SELECT constraint_name FROM information_schema.key_column_usage
     WHERE table_name = 'payment_proofs' AND column_name = 'booking_id'
     AND position_in_unique_constraint IS NOT NULL`,
  );
  expect(bookingForeignKeys).toHaveLength(0);
});

test('los CHECK rechazan estados con metadatos incoherentes', async () => {
  // Arrange / Act / Assert
  await expect(insertRawProof({ status: 'UPLOADED' })).rejects.toMatchObject({
    code: '23514',
    constraint: 'payment_proofs_status_fields_check',
  });
  await expect(
    insertRawProof({ status: 'AWAITING_UPLOAD', fileKey: 'private/unexpected' }),
  ).rejects.toMatchObject({ code: '23514', constraint: 'payment_proofs_status_fields_check' });
  await expect(insertRawProof({ status: 'EXPIRED' })).rejects.toMatchObject({
    code: '23514',
    constraint: 'payment_proofs_status_fields_check',
  });
  await expect(insertRawProof({ status: 'UNKNOWN' })).rejects.toMatchObject({
    code: '23514',
    constraint: 'payment_proofs_status_check',
  });
});

test('solo permite un comprobante por reserva', async () => {
  // Arrange
  const proof = createAwaiting();
  await repository.save(proof);

  // Act / Assert
  await expect(insertRawProof({ bookingId: proof.booking_id })).rejects.toMatchObject({
    code: '23505',
    constraint: 'payment_proofs_booking_id_unique',
  });
});

test.each([
  ['AWAITING_UPLOAD', (bookingId) => createAwaiting(bookingId)],
  ['UPLOADED', (bookingId) => createUploaded(bookingId)],
])('guarda y recupera un comprobante %s', async (status, createProof) => {
  // Arrange
  const proof = createProof(randomUUID());

  // Act
  const saved = await repository.save(proof);
  const found = await repository.findByBookingId(proof.booking_id);

  // Assert
  expect(saved).toMatchObject({
    id: expect.any(String),
    booking_id: proof.booking_id,
    cooperative_id: cooperativeId,
    status,
  });
  expect(saved.created_at).toBeInstanceOf(Date);
  expect(saved.updated_at).toBeInstanceOf(Date);
  if (status === 'UPLOADED') {
    expect(saved.uploaded_at).toBeInstanceOf(Date);
    expect(saved.expired_at).toBeNull();
  } else {
    expect(saved.uploaded_at).toBeNull();
    expect(saved.expired_at).toBeNull();
  }
  expect(found).toEqual(saved);
});

test('save actualiza el comprobante existente de la misma reserva', async () => {
  // Arrange
  const awaiting = createAwaiting();
  const initial = await repository.save(awaiting);
  const uploaded = createUploaded(awaiting.booking_id, 'private/replaced-proof');

  // Act
  const updated = await repository.save(uploaded);

  // Assert
  expect(updated.id).toBe(initial.id);
  expect(updated.status).toBe('UPLOADED');
  expect(updated.file_key).toBe('private/replaced-proof');
  await expect(repository.findByBookingId(awaiting.booking_id)).resolves.toEqual(updated);
  const { rows } = await pool.query('SELECT count(*)::integer AS total FROM payment_proofs');
  expect(rows[0].total).toBe(1);
});

test('la migración se revierte y puede aplicarse otra vez', async () => {
  // Arrange / Act
  runMigration('down');
  const { rows: removed } = await pool.query(
    "SELECT to_regclass('public.payment_proofs') AS table_name",
  );

  // Assert
  expect(removed[0].table_name).toBeNull();

  // Restore the schema for other integration suites.
  runMigration('up');
  const { rows: restored } = await pool.query(
    "SELECT to_regclass('public.payment_proofs') AS table_name",
  );
  expect(restored[0].table_name).toBe('payment_proofs');
});
