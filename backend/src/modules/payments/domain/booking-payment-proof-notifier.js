/** Puerto para avisar a reservas que se recibió un comprobante. */
class BookingPaymentProofNotifier {
  /**
   * markPaymentProofReceived({ bookingId, cooperativeId, paymentProofId }) registra el vínculo de forma idempotente.
   * bookings verifica el plazo con la hora del servidor y puede rechazarlo con
   * PaymentProofUploadDeadlineExpiredError cuando el plazo ya venció.
   * El adaptador real verifica ACCEPTED y sus vínculos antes de resolver.
   * Solo REJECTED_EXPIRED confirmado y vinculado se traduce al error de plazo;
   * errores de fuente, integridad o resultado desconocido conservan incertidumbre.
   */
  async markPaymentProofReceived() {
    throw new Error('BookingPaymentProofNotifier.markPaymentProofReceived debe implementarse.');
  }
}

module.exports = BookingPaymentProofNotifier;
