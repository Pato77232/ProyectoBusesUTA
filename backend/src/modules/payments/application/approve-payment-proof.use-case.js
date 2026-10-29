const { approvePaymentProof } = require('../domain/payment-proof-approval');
const {
  BookingSaleRejectedError,
  BookingSaleUncertainError,
  PaymentProofApprovalPersistenceUncertainError,
  PaymentProofNotFoundError,
  PaymentProofNotPendingError,
  PaymentProofValidationError,
} = require('../domain/payment-proof-error');

function requiredIdentifier(value) {
  if (typeof value !== 'string' || !value.trim()) throw new PaymentProofValidationError();
  return value.trim();
}

function validDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new PaymentProofValidationError();
  return date;
}

class ApprovePaymentProof {
  constructor({ paymentProofRepository, bookingSaleConfirmer }) {
    this.paymentProofRepository = paymentProofRepository;
    this.bookingSaleConfirmer = bookingSaleConfirmer;
  }

  async execute({ paymentProofId, cooperativeId, approverId, now }) {
    const proofId = requiredIdentifier(paymentProofId);
    const tenantId = requiredIdentifier(cooperativeId);
    const clerkId = requiredIdentifier(approverId);
    const decisionDate = validDate(now);
    let proof = await this.paymentProofRepository.findByIdAndCooperativeId(proofId, tenantId);

    if (!proof) throw new PaymentProofNotFoundError();
    if (proof.approved_at && proof.approved_by) return proof;
    if (proof.status !== 'UPLOADED') throw new PaymentProofNotPendingError();

    try {
      const confirmed = await this.bookingSaleConfirmer.confirmSale({
        bookingId: proof.booking_id,
        cooperativeId: proof.cooperative_id,
        paymentProofId: proof.id,
      });
      if (confirmed !== true) throw new BookingSaleUncertainError();
    } catch (error) {
      if (error instanceof BookingSaleRejectedError || error instanceof BookingSaleUncertainError) {
        throw error;
      }
      throw new BookingSaleUncertainError();
    }

    approvePaymentProof(proof, clerkId, decisionDate);
    try {
      const saved = await this.paymentProofRepository.markApprovedIfPending({
        paymentProofId: proofId,
        cooperativeId: tenantId,
        approvedBy: clerkId,
        approvedAt: decisionDate,
      });
      if (saved) return saved;
    } catch {
      throw new PaymentProofApprovalPersistenceUncertainError();
    }

    proof = await this.paymentProofRepository.findByIdAndCooperativeId(proofId, tenantId);
    if (proof?.approved_at && proof.approved_by) return proof;
    throw new PaymentProofNotPendingError();
  }
}

module.exports = ApprovePaymentProof;
