const { approvePaymentProof } = require('../domain/payment-proof-approval');
const {
  BookingSaleRejectedError,
  BookingSaleUncertainError,
  PaymentProofApprovalIntentPersistenceError,
  PaymentProofApprovalPersistenceUncertainError,
  PaymentProofNotFoundError,
  PaymentProofNotPendingError,
  PaymentProofValidationError,
} = require('../domain/payment-proof-error');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    if (!UUID_PATTERN.test(proofId)) throw new PaymentProofValidationError();
    const tenantId = requiredIdentifier(cooperativeId);
    const clerkId = requiredIdentifier(approverId);
    const decisionDate = validDate(now);
    let proof = await this.paymentProofRepository.findByIdAndCooperativeId(proofId, tenantId);

    if (!proof) throw new PaymentProofNotFoundError();
    if (proof.approved_at && proof.approved_by) return proof;
    if (proof.status !== 'UPLOADED') throw new PaymentProofNotPendingError();

    let approvalIntent;
    try {
      approvalIntent = await this.paymentProofRepository.markApprovalRequestedIfPending({
        paymentProofId: proofId,
        cooperativeId: tenantId,
        requestedBy: clerkId,
        requestedAt: decisionDate,
      });
    } catch {
      throw new PaymentProofApprovalIntentPersistenceError();
    }

    if (!approvalIntent) {
      proof = await this.paymentProofRepository.findByIdAndCooperativeId(proofId, tenantId);
      if (proof?.approved_at && proof.approved_by) return proof;
      throw new PaymentProofNotPendingError();
    }

    const originalApproverId = approvalIntent.approval_requested_by;
    if (!originalApproverId) throw new PaymentProofApprovalIntentPersistenceError();

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

    approvePaymentProof(approvalIntent, originalApproverId, decisionDate);
    try {
      const saved = await this.paymentProofRepository.markApprovedIfPending({
        paymentProofId: proofId,
        cooperativeId: tenantId,
        approvedBy: originalApproverId,
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
