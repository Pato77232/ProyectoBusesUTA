const BookingPaymentQueryError = require('../domain/booking-payment-query-error');
const { PaymentProofValidationError } = require('../domain/payment-proof-error');

const PAGE_SIZE = 50;
const identifier = (value) => typeof value === 'string' && value.trim().length > 0;

function verifiedContext(context) {
  if (!context || Array.isArray(context) || !identifier(context.userId)) {
    throw new BookingPaymentQueryError('UNAUTHENTICATED');
  }
  if (context.role !== 'CLERK' || !identifier(context.cooperativeId)) {
    throw new BookingPaymentQueryError('FORBIDDEN');
  }
  return Object.freeze({
    userId: context.userId,
    role: context.role,
    cooperativeId: context.cooperativeId,
  });
}

class ListAuthorizedPaymentProofs {
  constructor({ paymentProofRepository, bookingReader }) {
    this.paymentProofRepository = paymentProofRepository;
    this.bookingReader = bookingReader;
  }

  async execute({ authContext, cursor = null }) {
    const context = verifiedContext(authContext);
    if (cursor !== null && !identifier(cursor)) throw new PaymentProofValidationError();
    const page = await this.paymentProofRepository.listPendingByCooperative({
      cooperativeId: context.cooperativeId,
      limit: PAGE_SIZE,
      cursor,
    });
    const items = await Promise.all(
      page.items.map(async (proof) => {
        if (proof.cooperative_id !== context.cooperativeId || !identifier(proof.booking_id)) {
          throw new BookingPaymentQueryError('BOOKING_DATA_INTEGRITY_ERROR');
        }
        const booking = await this.bookingReader.findForPayment(
          {
            bookingId: proof.booking_id,
            purpose: 'REVIEW_PAYMENT',
          },
          context,
        );
        if (
          !booking ||
          booking.bookingId !== proof.booking_id ||
          booking.cooperativeId !== context.cooperativeId ||
          booking.currency !== 'USD' ||
          !Number.isSafeInteger(booking.total) ||
          booking.total < 0
        ) {
          throw new BookingPaymentQueryError('BOOKING_DATA_INTEGRITY_ERROR');
        }
        return Object.freeze({ ...proof, total_cents: booking.total });
      }),
    );
    return Object.freeze({ items: Object.freeze(items), nextCursor: page.nextCursor });
  }
}

module.exports = ListAuthorizedPaymentProofs;
