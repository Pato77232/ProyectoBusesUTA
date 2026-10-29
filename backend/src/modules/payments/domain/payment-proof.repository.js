/** Puerto de persistencia de comprobantes de pago. */
class PaymentProofRepository {
  /** findByBookingId(bookingId) devuelve el comprobante de la reserva o null. */
  async findByBookingId() {
    throw new Error('PaymentProofRepository.findByBookingId debe implementarse.');
  }

  /** save(paymentProof) persiste el comprobante y devuelve la entidad guardada. */
  async save() {
    throw new Error('PaymentProofRepository.save debe implementarse.');
  }

  /** Guarda el comprobante y el aviso pendiente en una transacción local. */
  async saveWithPendingNotification() {
    throw new Error('PaymentProofRepository.saveWithPendingNotification debe implementarse.');
  }

  /** Registra un intento durable de notificación. */
  async markNotificationAttempted() {
    throw new Error('PaymentProofRepository.markNotificationAttempted debe implementarse.');
  }

  /** Marca como entregado el aviso de una reserva. */
  async markNotificationDelivered() {
    throw new Error('PaymentProofRepository.markNotificationDelivered debe implementarse.');
  }

  /** deleteByBookingId(bookingId) elimina el registro compensado. */
  async deleteByBookingId() {
    throw new Error('PaymentProofRepository.deleteByBookingId debe implementarse.');
  }
}

module.exports = PaymentProofRepository;
