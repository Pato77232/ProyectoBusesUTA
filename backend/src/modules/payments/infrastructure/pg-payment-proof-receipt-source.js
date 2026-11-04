const {
  PaymentProofValidationError,
  BookingNotificationUncertainError,
} = require('../domain/payment-proof-error');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class PgPaymentProofReceiptSource {
  constructor({ pool }) {
    this.pool = pool;
  }
  async findForBookingReceipt(input) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      typeof input.paymentProofId !== 'string' ||
      !UUID_PATTERN.test(input.paymentProofId)
    )
      throw new PaymentProofValidationError();
    const paymentProofId = input.paymentProofId;
    try {
      const { rows } = await this.pool.query(
        `SELECT p.id AS "paymentProofId", p.booking_id AS "bookingId",
         p.cooperative_id AS "cooperativeId", p.status,
         o.status AS "notificationStatus", p.uploaded_at AS "uploadedAt"
         FROM payment_proofs p JOIN payment_proof_notification_outbox o
         ON o.payment_proof_id=p.id AND o.booking_id=p.booking_id
         WHERE p.id=$1 AND p.file_key IS NOT NULL AND p.uploaded_at IS NOT NULL
           AND p.file_size_bytes>0 AND p.upload_authorized_by IS NOT NULL
           AND p.upload_authorized_at IS NOT NULL`,
        [paymentProofId],
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return Object.freeze({
        paymentProofId: row.paymentProofId,
        bookingId: row.bookingId,
        cooperativeId: row.cooperativeId,
        status: row.status,
        notificationStatus: row.notificationStatus,
        uploadedAt: row.uploadedAt.toISOString(),
      });
    } catch {
      throw new BookingNotificationUncertainError();
    }
  }
}
module.exports = PgPaymentProofReceiptSource;
