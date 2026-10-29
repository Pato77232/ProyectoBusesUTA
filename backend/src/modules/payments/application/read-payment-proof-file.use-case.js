const {
  PaymentProofNotFoundError,
  PaymentProofNotPendingError,
  PaymentProofValidationError,
} = require('../domain/payment-proof-error');

function requiredIdentifier(value) {
  if (typeof value !== 'string' || !value.trim()) throw new PaymentProofValidationError();
  return value.trim();
}

class ReadPaymentProofFile {
  constructor({ paymentProofRepository, fileReader }) {
    this.paymentProofRepository = paymentProofRepository;
    this.fileReader = fileReader;
  }

  async execute({ paymentProofId, cooperativeId }) {
    const proofId = requiredIdentifier(paymentProofId);
    const tenantId = requiredIdentifier(cooperativeId);
    const proof = await this.paymentProofRepository.findByIdAndCooperativeId(proofId, tenantId);

    if (!proof) throw new PaymentProofNotFoundError();
    if (proof.status !== 'UPLOADED' || proof.approved_at) {
      throw new PaymentProofNotPendingError();
    }

    const content = await this.fileReader.read(proof.file_key);
    if (!Buffer.isBuffer(content)) throw new PaymentProofValidationError();

    return Object.freeze({
      content,
      mediaType: proof.media_type,
      originalFileName: proof.original_file_name,
    });
  }
}

module.exports = ReadPaymentProofFile;
