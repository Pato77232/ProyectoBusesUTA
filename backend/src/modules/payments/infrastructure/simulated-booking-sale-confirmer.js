const BookingSaleConfirmer = require('../domain/booking-sale-confirmer');
const { BookingSaleRejectedError } = require('../domain/payment-proof-error');

class SimulatedBookingSaleConfirmer extends BookingSaleConfirmer {
  constructor({ rejections = [] } = {}) {
    super();
    this.rejections = new Set(rejections);
    this.confirmedProofIds = new Set();
  }

  async confirmSale({ paymentProofId }) {
    if (this.rejections.has(paymentProofId)) throw new BookingSaleRejectedError();
    this.confirmedProofIds.add(paymentProofId);
    return true;
  }
}

module.exports = SimulatedBookingSaleConfirmer;
