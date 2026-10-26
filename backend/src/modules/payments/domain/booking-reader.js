/** Puerto de lectura de reservas que payments necesita para validar una carga. */
class BookingReader {
  /**
   * findForPayment(bookingId) devuelve los datos de reserva requeridos o null, más
   * bookingId, ownerId, cooperativeId, status, expiresAt, total y
   * acceptsPaymentProof, ya resuelto por bookings según su estado real.
   * total es un entero expresado en centavos.
   * payments no asume nombres para los estados propios de bookings.
   */
  async findForPayment() {
    throw new Error('BookingReader.findForPayment debe implementarse.');
  }
}

module.exports = BookingReader;
