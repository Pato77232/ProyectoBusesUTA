const BookingSaleConfirmer = require('../domain/booking-sale-confirmer');
const { BookingSaleRejectedError } = require('../domain/payment-proof-error');

class SimulatedBookingSaleConfirmer extends BookingSaleConfirmer {
  constructor({ rejections = [] } = {}) {
    super();
    this.rejections = new Set(rejections);
    this.confirmedProofIds = new Set();
    this.confirmedSales = new Map();
  }

  async confirmSale(sale) {
    const { bookingId, cooperativeId, paymentProofId } = sale;
    if (this.rejections.has(paymentProofId)) throw new BookingSaleRejectedError();
    const previousSale = this.confirmedSales.get(paymentProofId);
    if (
      previousSale &&
      (previousSale.bookingId !== bookingId || previousSale.cooperativeId !== cooperativeId)
    ) {
      throw new BookingSaleRejectedError();
    }
    this.confirmedSales.set(paymentProofId, Object.freeze({ ...sale }));
    this.confirmedProofIds.add(paymentProofId);
    return true;
  }
}

module.exports = SimulatedBookingSaleConfirmer;
