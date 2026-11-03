const BookingsPaymentProofNotifier = require('./bookings-payment-proof-notifier');
const {
  BookingNotificationUncertainError,
  PaymentProofUploadDeadlineExpiredError,
} = require('../domain/payment-proof-error');

function createBookingPaymentProofNotifier({ receiptReceiver } = {}) {
  const notifier = new BookingsPaymentProofNotifier({ receiver: receiptReceiver });
  return Object.freeze({
    async markPaymentProofReceived(input) {
      try {
        return await notifier.receiveAcknowledgement(input);
      } catch (error) {
        if (error instanceof PaymentProofUploadDeadlineExpiredError) throw error;
        throw new BookingNotificationUncertainError();
      }
    },
  });
}
module.exports = createBookingPaymentProofNotifier;
