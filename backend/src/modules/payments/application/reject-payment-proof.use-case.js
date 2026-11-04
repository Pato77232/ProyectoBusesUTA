const {
  PaymentProofNotFoundError,
  PaymentProofNotPendingError,
  PaymentProofValidationError,
  BookingSaleRejectedError,
  BookingSaleUncertainError,
} = require('../domain/payment-proof-error');

class RejectPaymentProof {
  constructor({ paymentProofRepository, bookingSaleConfirmer }) {
    this.paymentProofRepository = paymentProofRepository;
    this.bookingSaleConfirmer = bookingSaleConfirmer;
  }

  async execute({ paymentProofId, cooperativeId, rejectedBy, justification, now }) {
    if (
      typeof paymentProofId !== 'string' ||
      !paymentProofId.trim() ||
      typeof cooperativeId !== 'string' ||
      !cooperativeId.trim() ||
      typeof rejectedBy !== 'string' ||
      !rejectedBy.trim() ||
      typeof justification !== 'string' ||
      !justification.trim()
    )
      throw new PaymentProofValidationError();
    const decisionDate = now instanceof Date ? new Date(now.getTime()) : new Date(now);
    if (Number.isNaN(decisionDate.getTime())) throw new PaymentProofValidationError();
    const proof = await this.paymentProofRepository.findByIdAndCooperativeId(
      paymentProofId.trim(),
      cooperativeId.trim(),
    );
    if (!proof) throw new PaymentProofNotFoundError();
    if (proof.status !== 'UPLOADED' || proof.approved_at) throw new PaymentProofNotPendingError();
    try {
      await this.bookingSaleConfirmer.rejectSale({
        bookingId: proof.booking_id,
        cooperativeId: proof.cooperative_id,
        paymentProofId: proof.id,
        rejectedBy: rejectedBy.trim(),
        justification: justification.trim(),
      });
    } catch (error) {
      if (error?.code === 'BOOKING_SALE_REJECTED') throw new BookingSaleRejectedError();
      if (error?.code === 'BOOKING_SALE_UNCERTAIN') throw new BookingSaleUncertainError();
      throw new BookingSaleUncertainError();
    }
    const saved = await this.paymentProofRepository.markRejectedIfPending({
      paymentProofId: proof.id,
      cooperativeId: proof.cooperative_id,
      rejectedBy: rejectedBy.trim(),
      rejectionJustification: justification.trim(),
      rejectedAt: decisionDate,
    });
    if (!saved) throw new BookingSaleUncertainError();
    return saved;
  }
}

module.exports = RejectPaymentProof;
