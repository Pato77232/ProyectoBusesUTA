const { BookingPaymentProofRejectedError } = require('../domain/payment-proof-error');

class SimulatedBookingPaymentProofNotifier {
  constructor(rejections = new Map()) {
    this.rejections = rejections;
    this.receivedBookingIds = new Set();
  }

  async markPaymentProofReceived(bookingId) {
    if (this.rejections.has(bookingId)) throw this.rejections.get(bookingId);
    this.receivedBookingIds.add(bookingId);
  }

  rejectDefinitively(bookingId) {
    this.rejections.set(bookingId, new BookingPaymentProofRejectedError());
  }
}

module.exports = SimulatedBookingPaymentProofNotifier;
