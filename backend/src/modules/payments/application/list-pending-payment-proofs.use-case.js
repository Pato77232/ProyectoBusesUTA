const {
  PaymentProofValidationError,
  PaymentProofTotalUnavailableError,
} = require('../domain/payment-proof-error');

const DEFAULT_PAGE_SIZE = 50;

function requiredIdentifier(value) {
  if (typeof value !== 'string' || !value.trim()) throw new PaymentProofValidationError();
  return value.trim();
}

class ListPendingPaymentProofs {
  constructor({ paymentProofRepository, bookingReader }) {
    this.paymentProofRepository = paymentProofRepository;
    this.bookingReader = bookingReader;
  }

  async execute({ cooperativeId, cursor = null }) {
    const verifiedCooperativeId = requiredIdentifier(cooperativeId);
    if (cursor !== null && (typeof cursor !== 'string' || !cursor.trim())) {
      throw new PaymentProofValidationError();
    }

    const page = await this.paymentProofRepository.listPendingByCooperative({
      cooperativeId: verifiedCooperativeId,
      limit: DEFAULT_PAGE_SIZE,
      cursor,
    });
    const items = await Promise.all(
      page.items.map(async (proof) => {
        let booking;
        try {
          booking = await this.bookingReader.findForPayment(proof.booking_id);
        } catch {
          throw new PaymentProofTotalUnavailableError();
        }
        if (
          !booking ||
          booking.cooperativeId !== verifiedCooperativeId ||
          !Number.isSafeInteger(booking.total) ||
          booking.total < 0
        ) {
          throw new PaymentProofTotalUnavailableError();
        }
        return Object.freeze({ ...proof, total_cents: booking.total });
      }),
    );

    return Object.freeze({ items: Object.freeze(items), nextCursor: page.nextCursor });
  }
}

module.exports = ListPendingPaymentProofs;
