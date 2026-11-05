const { randomUUID } = require('node:crypto');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const PgPaymentProofRepository = require('../../../src/modules/payments/infrastructure/pg-payment-proof.repository');
const { createNotificationsModule } = require('../../../src/modules/notifications');
const {
  createPaymentProof,
  uploadPaymentProof,
} = require('../../../src/modules/payments/domain/payment-proof');

const NOW = new Date('2026-10-26T12:00:00.000Z');
let pool, outbox, repository, cooperativeId;

async function createCooperative() {
  const ruc = randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7');
  const { rows } = await pool.query(
    'INSERT INTO cooperatives(name, ruc) VALUES ($1, $2) RETURNING id',
    ['Cooperativa de avisos', ruc],
  );
  return rows[0].id;
}

async function uploadedProof(target = repository) {
  const awaiting = createPaymentProof({ booking_id: randomUUID(), cooperative_id: cooperativeId });
  const uploaded = uploadPaymentProof(
    awaiting,
    {
      file_key: 'private/proof-aviso',
      original_file_name: 'transferencia.pdf',
      media_type: 'application/pdf',
      file_size_bytes: 1024,
    },
    new Date('2026-10-25T14:05:00.000Z'),
    new Date('2026-10-25T14:00:00.000Z'),
  );
  return target.save(uploaded);
}

async function approve(proof, target = repository) {
  const clerk = randomUUID();
  await target.markApprovalRequestedIfPending({
    paymentProofId: proof.id,
    cooperativeId,
    requestedBy: clerk,
    requestedAt: NOW,
  });
  return target.markApprovedIfPending({
    paymentProofId: proof.id,
    cooperativeId,
    approvedBy: clerk,
    approvedAt: NOW,
  });
}

function reject(proof, justification, target = repository) {
  return target.markRejectedIfPending({
    paymentProofId: proof.id,
    cooperativeId,
    rejectedBy: randomUUID(),
    rejectionJustification: justification,
    rejectedAt: NOW,
  });
}

const notices = async () =>
  (await pool.query('SELECT kind, booking_id, cooperative_id, payload FROM email_notifications'))
    .rows;

beforeAll(() => {
  runMigration();
  pool = testPool();
  outbox = createNotificationsModule({ clock: () => NOW }).outbox;
  repository = new PgPaymentProofRepository(pool, { notificationOutbox: outbox });
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE email_notifications, payment_proof_notification_outbox, payment_proofs',
  );
  cooperativeId = await createCooperative();
});
afterAll(async () => {
  if (pool) {
    await pool.query(
      'TRUNCATE email_notifications, payment_proof_notification_outbox, payment_proofs',
    );
    await pool.end();
  }
});

test('aprobar encola un único aviso de boletos listos', async () => {
  const proof = await uploadedProof();
  const approved = await approve(proof);
  expect(approved.approved_at).toEqual(NOW);
  expect(await notices()).toEqual([
    {
      kind: 'TICKETS_READY',
      booking_id: proof.booking_id,
      cooperative_id: cooperativeId,
      payload: {},
    },
  ]);
  const repeated = await repository.markApprovedIfPending({
    paymentProofId: proof.id,
    cooperativeId,
    approvedBy: randomUUID(),
    approvedAt: NOW,
  });
  expect(repeated).toBeNull();
  expect(await notices()).toHaveLength(1);
});

test('si encolar falla, la aprobación se revierte completa', async () => {
  const failing = new PgPaymentProofRepository(pool, {
    notificationOutbox: {
      maxJustificationLength: 1000,
      enqueueWith: async () => {
        throw new Error('outbox caído');
      },
    },
  });
  const proof = await uploadedProof(failing);
  await expect(approve(proof, failing)).rejects.toThrow('outbox caído');
  const { rows } = await pool.query('SELECT approved_at FROM payment_proofs WHERE id = $1', [
    proof.id,
  ]);
  expect(rows[0].approved_at).toBeNull();
  expect(await notices()).toEqual([]);
});

test('rechazar encola el aviso con la justificación', async () => {
  const proof = await uploadedProof();
  const rejected = await reject(proof, 'El monto no coincide con la reserva');
  expect(rejected.status).toBe('REJECTED');
  expect(await notices()).toEqual([
    {
      kind: 'PROOF_REJECTED',
      booking_id: proof.booking_id,
      cooperative_id: cooperativeId,
      payload: { justification: 'El monto no coincide con la reserva' },
    },
  ]);
  await expect(reject(proof, 'Otra vez')).resolves.toBeNull();
  expect(await notices()).toHaveLength(1);
});

test('una justificación larga se conserva en Pagos y se recorta en el aviso', async () => {
  const proof = await uploadedProof();
  const justification = 'x'.repeat(1500);
  await reject(proof, justification);
  const { rows } = await pool.query(
    'SELECT rejection_justification FROM payment_proofs WHERE id = $1',
    [proof.id],
  );
  expect(rows[0].rejection_justification).toHaveLength(1500);
  expect((await notices())[0].payload.justification).toHaveLength(1000);
});

test('sin outbox, Pagos se comporta como antes y no encola', async () => {
  const plain = new PgPaymentProofRepository(pool);
  const proof = await uploadedProof(plain);
  await approve(proof, plain);
  await reject(await uploadedProof(plain), 'Ilegible', plain);
  expect(await notices()).toEqual([]);
});
