const { receiptRequest, acknowledgeReceipt } = require('../domain/booking-proof-receipt');
const { BookingNotificationUncertainError } = require('../domain/payment-proof-error');

class BookingsPaymentProofNotifier {
  constructor({ receiver }) {
    if (typeof receiver?.markPaymentProofReceived !== 'function')
      throw new TypeError('Se requiere el receptor público de Reservas.');
    this.receiver = receiver;
  }
  async markPaymentProofReceived(input) {
    const target = receiptRequest(input);
    let result;
    try {
      result = await this.receiver.markPaymentProofReceived(target);
    } catch {
      // Ninguna excepción del proveedor certifica un rechazo con COMMIT conocido.
      throw new BookingNotificationUncertainError();
    }
    acknowledgeReceipt(result, target);
  }
}
module.exports = BookingsPaymentProofNotifier;
