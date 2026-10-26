const PaymentProofRepository = require('../domain/payment-proof.repository');
const {
  createPaymentProof,
  uploadPaymentProof,
  expirePaymentProof,
} = require('../domain/payment-proof');

const PAYMENT_PROOF_COLUMNS = `id, booking_id, cooperative_id, status, file_key,
  original_file_name, media_type, file_size_bytes, uploaded_at, expired_at,
  created_at, updated_at`;

function asDate(value) {
  return value === null ? null : new Date(value);
}

function withPersistenceDates(paymentProof, row) {
  return Object.freeze({
    ...paymentProof,
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
    return toPaymentProof(rows[0]);
  }
}

module.exports = PgPaymentProofRepository;
