const {
  receiptRequest,
  receiptResult,
  acknowledgeReceipt,
} = require('../domain/booking-proof-receipt');
const {
  PaymentProofValidationError,
  BookingNotificationUncertainError,
} = require('../domain/payment-proof-error');

class BookingsPaymentProofNotifier {
  constructor({ receiver }) {
    if (typeof receiver?.markPaymentProofReceived !== 'function')
      throw new TypeError('Se requiere el receptor público de Reservas.');
    this.receive = receiver.markPaymentProofReceived.bind(receiver);
  }
  async receiveAcknowledgement(input) {
    let target;
    try {
      target = receiptRequest(input);
    } catch (error) {
      if (error instanceof PaymentProofValidationError) throw error;
      throw new BookingNotificationUncertainError();
    }
    let result;
    try {
      result = receiptResult(await this.receive(target), target);
    } catch {
      // Leer el payload o invocar al proveedor no certifica un rechazo durable.
      throw new BookingNotificationUncertainError();
    }
    // Solo el resultado ya capturado y validado puede autorizar compensación.
    return acknowledgeReceipt(result, target);
  }
  async markPaymentProofReceived(input) {
    await this.receiveAcknowledgement(input);
  }
}
module.exports = BookingsPaymentProofNotifier;
