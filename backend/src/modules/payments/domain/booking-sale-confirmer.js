/** Puerto público de pagos para pedir a bookings que confirme una venta. */
class BookingSaleConfirmer {
  /**
   * confirmSale({ bookingId, cooperativeId, paymentProofId }) valida los vínculos y
   * confirma idempotentemente, devolviendo el mismo resultado para la misma clave.
   */
  async confirmSale() {
    throw new Error('BookingSaleConfirmer.confirmSale debe implementarse.');
  }
}

module.exports = BookingSaleConfirmer;
