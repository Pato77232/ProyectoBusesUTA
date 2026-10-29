/** Puerto público de pagos para pedir a bookings que confirme una venta. */
class BookingSaleConfirmer {
  /** confirmSale({ bookingId, cooperativeId, paymentProofId }) confirma idempotentemente. */
  async confirmSale() {
    throw new Error('BookingSaleConfirmer.confirmSale debe implementarse.');
  }
}

module.exports = BookingSaleConfirmer;
