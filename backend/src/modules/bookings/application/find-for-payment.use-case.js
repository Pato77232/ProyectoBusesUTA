const { paymentReadRequest, paymentBooking } = require('../domain/payment-booking');
const BookingPaymentQueryError = require('../domain/booking-payment-query-error');

function findForPayment({ repository, clock }) {
  return async (query, authContext) => {
    // Copiar y validar antes del await impide que el llamador altere el alcance.
    const request = paymentReadRequest(query, authContext);
    let row;
    try {
      row = await repository.findPaymentRecord(request);
    } catch (error) {
      throw new BookingPaymentQueryError(
        error?.code === 'BOOKING_QUERY_UNAVAILABLE' ? error.code : 'INTERNAL_ERROR',
      );
    }
    if (row === null) return null;
    return paymentBooking(row, request, clock());
  };
}
module.exports = findForPayment;
