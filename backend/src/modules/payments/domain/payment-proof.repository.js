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
}

module.exports = PaymentProofRepository;
