const { BookingPaymentProofRejectedError } = require('../domain/payment-proof-error');

class SimulatedBookingPaymentProofNotifier {
  constructor(rejections = new Map()) {
    this.rejections = rejections;
    this.receivedProofs = new Map();
  }

  async markPaymentProofReceived(receipt) {
    const { bookingId, cooperativeId, paymentProofId } = receipt;
    if (this.rejections.has(paymentProofId)) throw this.rejections.get(paymentProofId);
    const priorReceipt = this.receivedProofs.get(paymentProofId);
    if (
      priorReceipt &&
      (priorReceipt.bookingId !== bookingId || priorReceipt.cooperativeId !== cooperativeId)
    ) {
      throw new BookingPaymentProofRejectedError();
    }
    this.receivedProofs.set(paymentProofId, Object.freeze({ ...receipt }));
  }

  rejectDefinitively(paymentProofId) {
    this.rejections.set(paymentProofId, new BookingPaymentProofRejectedError());
  }
}

module.exports = SimulatedBookingPaymentProofNotifier;
