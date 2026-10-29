const { PaymentProofValidationError } = require('../domain/payment-proof-error');

const DEFAULT_PAGE_SIZE = 50;

function requiredIdentifier(value) {
  if (typeof value !== 'string' || !value.trim()) throw new PaymentProofValidationError();
  return value.trim();
}

class ListPendingPaymentProofs {
  constructor({ paymentProofRepository }) {
    this.paymentProofRepository = paymentProofRepository;
  }

  async execute({ cooperativeId, cursor = null }) {
    const verifiedCooperativeId = requiredIdentifier(cooperativeId);
    if (cursor !== null && (typeof cursor !== 'string' || !cursor.trim())) {
      throw new PaymentProofValidationError();
    }

    return this.paymentProofRepository.listPendingByCooperative({
      cooperativeId: verifiedCooperativeId,
      limit: DEFAULT_PAGE_SIZE,
      cursor,
    });
  }
}

module.exports = ListPendingPaymentProofs;
