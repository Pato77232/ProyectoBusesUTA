const PaymentProofRepository = require('../domain/payment-proof.repository');
const {
  PaymentProofAlreadyUploadedError,
  PaymentProofPersistenceUncertainError,
  PaymentProofValidationError,
} = require('../domain/payment-proof-error');
const {
  createPaymentProof,
  uploadPaymentProof,
  expirePaymentProof,
} = require('../domain/payment-proof');

const PAYMENT_PROOF_COLUMNS = `id, booking_id, cooperative_id, status, file_key,
  original_file_name, media_type, file_size_bytes, uploaded_at, expired_at,
  approved_at, approved_by, approval_requested_at, approval_requested_by,
  created_at, updated_at`;

const MAX_PAGE_SIZE = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCursor(cursor) {
  if (cursor === null || cursor === undefined) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const value = JSON.parse(decoded);
    const uploadedAt = new Date(value.uploadedAt);
    if (
      !value ||
      typeof value.uploadedAt !== 'string' ||
      Number.isNaN(uploadedAt.getTime()) ||
      typeof value.id !== 'string' ||
      !UUID_PATTERN.test(value.id)
    ) {
      throw new Error('cursor inválido');
    }
    return { uploadedAt, id: value.id };
  } catch {
    throw new PaymentProofValidationError();
  }
}

function createCursor(paymentProof) {
  return Buffer.from(
    JSON.stringify({ uploadedAt: paymentProof.uploaded_at.toISOString(), id: paymentProof.id }),
  ).toString('base64url');
}

function asDate(value) {
  return value === null ? null : new Date(value);
}

function withPersistenceDates(paymentProof, row) {
  return Object.freeze({
    ...paymentProof,
    approved_at: asDate(row.approved_at),
    approved_by: row.approved_by,
    approval_requested_at: asDate(row.approval_requested_at),
    approval_requested_by: row.approval_requested_by,
    created_at: asDate(row.created_at),
    updated_at: asDate(row.updated_at),
  });
}

function toPaymentProof(row) {
  const awaitingUpload = createPaymentProof({
    id: row.id,
    booking_id: row.booking_id,
    cooperative_id: row.cooperative_id,
  });

  if (row.status === 'AWAITING_UPLOAD') {
    return withPersistenceDates(awaitingUpload, row);
  }

  if (row.status === 'UPLOADED') {
    const uploadedAt = asDate(row.uploaded_at);
    const uploaded = uploadPaymentProof(
      awaitingUpload,
      {
        file_key: row.file_key,
        original_file_name: row.original_file_name,
        media_type: row.media_type,
        file_size_bytes: Number(row.file_size_bytes),
      },
      new Date(uploadedAt.getTime() + 1),
      uploadedAt,
    );
    return withPersistenceDates(uploaded, row);
  }

  return withPersistenceDates(expirePaymentProof(awaitingUpload, asDate(row.expired_at)), row);
}

class PgPaymentProofRepository extends PaymentProofRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findByBookingId(bookingId) {
    const { rows } = await this.pool.query(
      `SELECT ${PAYMENT_PROOF_COLUMNS} FROM payment_proofs WHERE booking_id = $1`,
      [bookingId],
    );
    return rows.length === 0 ? null : toPaymentProof(rows[0]);
  }

  async listPendingByCooperative({ cooperativeId, limit, cursor }) {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new PaymentProofValidationError();
    }
    const position = parseCursor(cursor);
    const values = [cooperativeId, limit + 1];
    let cursorClause = '';
    if (position) {
      values.push(position.uploadedAt, position.id);
      cursorClause = 'AND (uploaded_at, id) < ($3, $4)';
    }

    const { rows } = await this.pool.query(
      `SELECT ${PAYMENT_PROOF_COLUMNS} FROM payment_proofs
       WHERE cooperative_id = $1 AND status = 'UPLOADED' AND approved_at IS NULL
       ${cursorClause}
       ORDER BY uploaded_at DESC, id DESC LIMIT $2`,
      values,
    );
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => {
      const proof = toPaymentProof(row);
      const { file_key: _fileKey, ...safeProof } = proof;
      return Object.freeze(safeProof);
    });

    return Object.freeze({
      items: Object.freeze(items),
      nextCursor: hasMore ? createCursor(items[items.length - 1]) : null,
    });
  }

  async findByIdAndCooperativeId(paymentProofId, cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT ${PAYMENT_PROOF_COLUMNS} FROM payment_proofs
       WHERE id = $1 AND cooperative_id = $2`,
      [paymentProofId, cooperativeId],
    );
    return rows.length === 0 ? null : toPaymentProof(rows[0]);
  }

  async markApprovedIfPending({ paymentProofId, cooperativeId, approvedBy, approvedAt }) {
    const { rows } = await this.pool.query(
      `UPDATE payment_proofs SET approved_by = approval_requested_by, approved_at = $4,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND cooperative_id = $2 AND status = 'UPLOADED'
         AND approved_at IS NULL AND approval_requested_by = $3
         AND approval_requested_at IS NOT NULL
       RETURNING ${PAYMENT_PROOF_COLUMNS}`,
      [paymentProofId, cooperativeId, approvedBy, approvedAt],
    );
    return rows.length === 0 ? null : toPaymentProof(rows[0]);
  }

  async markApprovalRequestedIfPending({
    paymentProofId,
    cooperativeId,
    requestedBy,
    requestedAt,
  }) {
    const { rows } = await this.pool.query(
      `UPDATE payment_proofs
       SET approval_requested_by = COALESCE(approval_requested_by, $3),
           approval_requested_at = COALESCE(approval_requested_at, $4),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND cooperative_id = $2 AND status = 'UPLOADED'
         AND approved_at IS NULL
         AND (approval_requested_at IS NULL OR approval_requested_by IS NOT NULL)
       RETURNING ${PAYMENT_PROOF_COLUMNS}`,
      [paymentProofId, cooperativeId, requestedBy, requestedAt],
    );
    return rows.length === 0 ? null : toPaymentProof(rows[0]);
  }

  async save(paymentProof) {
    const { rows } = await this.pool.query(
      `INSERT INTO payment_proofs(
        booking_id, cooperative_id, status, file_key, original_file_name,
        media_type, file_size_bytes, uploaded_at, expired_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (booking_id) DO UPDATE SET
        cooperative_id = EXCLUDED.cooperative_id,
        status = EXCLUDED.status,
        file_key = EXCLUDED.file_key,
        original_file_name = EXCLUDED.original_file_name,
        media_type = EXCLUDED.media_type,
        file_size_bytes = EXCLUDED.file_size_bytes,
        uploaded_at = EXCLUDED.uploaded_at,
        expired_at = EXCLUDED.expired_at,
        updated_at = CURRENT_TIMESTAMP
      WHERE payment_proofs.approved_at IS NULL
        AND payment_proofs.approval_requested_at IS NULL
      RETURNING ${PAYMENT_PROOF_COLUMNS}`,
      [
        paymentProof.booking_id,
        paymentProof.cooperative_id,
        paymentProof.status,
        paymentProof.file_key,
        paymentProof.original_file_name,
        paymentProof.media_type,
        paymentProof.file_size_bytes,
        paymentProof.uploaded_at,
        paymentProof.expired_at,
      ],
    );
    if (rows.length === 0) throw new PaymentProofAlreadyUploadedError();
    return toPaymentProof(rows[0]);
  }

  async saveWithPendingNotification(paymentProof) {
    const client = await this.pool.connect();
    let committing = false;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO payment_proofs(
          booking_id, cooperative_id, status, file_key, original_file_name,
          media_type, file_size_bytes, uploaded_at, expired_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (booking_id) DO UPDATE SET
          cooperative_id = EXCLUDED.cooperative_id,
          status = EXCLUDED.status,
          file_key = EXCLUDED.file_key,
          original_file_name = EXCLUDED.original_file_name,
          media_type = EXCLUDED.media_type,
          file_size_bytes = EXCLUDED.file_size_bytes,
          uploaded_at = EXCLUDED.uploaded_at,
          expired_at = EXCLUDED.expired_at,
          updated_at = CURRENT_TIMESTAMP
        WHERE payment_proofs.status = 'AWAITING_UPLOAD'
        RETURNING ${PAYMENT_PROOF_COLUMNS}`,
        [
          paymentProof.booking_id,
          paymentProof.cooperative_id,
          paymentProof.status,
          paymentProof.file_key,
          paymentProof.original_file_name,
          paymentProof.media_type,
          paymentProof.file_size_bytes,
          paymentProof.uploaded_at,
          paymentProof.expired_at,
        ],
      );
      if (rows.length === 0) throw new PaymentProofAlreadyUploadedError();
      const savedProof = toPaymentProof(rows[0]);
      await client.query(
        `INSERT INTO payment_proof_notification_outbox(payment_proof_id, booking_id)
         VALUES ($1, $2)
         ON CONFLICT (payment_proof_id) DO NOTHING`,
        [savedProof.id, savedProof.booking_id],
      );
      committing = true;
      await client.query('COMMIT');
      return savedProof;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (committing) throw new PaymentProofPersistenceUncertainError();
      throw error;
    } finally {
      client.release();
    }
  }

  async markNotificationAttempted(bookingId) {
    const { rowCount } = await this.pool.query(
      `UPDATE payment_proof_notification_outbox
       SET attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [bookingId],
    );
    if (rowCount === 0) throw new Error('No existe el aviso pendiente del comprobante.');
  }

  async markNotificationDelivered(bookingId) {
    const { rowCount } = await this.pool.query(
      `UPDATE payment_proof_notification_outbox
       SET status = 'DELIVERED', delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [bookingId],
    );
    if (rowCount === 0) throw new Error('No existe el aviso pendiente del comprobante.');
  }

  async deleteByBookingId(bookingId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM payment_proof_notification_outbox WHERE booking_id = $1', [
        bookingId,
      ]);
      await client.query('DELETE FROM payment_proofs WHERE booking_id = $1', [bookingId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = PgPaymentProofRepository;
