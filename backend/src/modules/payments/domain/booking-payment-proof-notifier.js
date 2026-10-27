/** Puerto para avisar a reservas que se recibió un comprobante. */
class BookingPaymentProofNotifier {
  /**
   * markPaymentProofReceived(bookingId) registra el aviso de forma idempotente.
   * bookings verifica el plazo con la hora del servidor y puede rechazarlo con
   * PaymentProofUploadDeadlineExpiredError cuando el plazo ya venció.
   */
  async markPaymentProofReceived() {
    throw new Error('BookingPaymentProofNotifier.markPaymentProofReceived debe implementarse.');
  }
}

module.exports = BookingPaymentProofNotifier;
