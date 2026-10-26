const { createPaymentProof, uploadPaymentProof } = require('../domain/payment-proof');
const {
  BookingNotFoundOrNotOwnedError,
  BookingNotPayableError,
  PaymentProofValidationError,
} = require('../domain/payment-proof-error');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png']);

function identifyMediaType(buffer) {
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';

  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) return 'image/jpeg';

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.subarray(0, pngSignature.length).equals(pngSignature)) return 'image/png';

  return null;
}

function sanitizeOriginalFileName(fileName) {
  return fileName
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

function validateFile(file) {
  if (!file || typeof file !== 'object' || !Buffer.isBuffer(file.buffer)) {
    throw new PaymentProofValidationError();
  }

  const { buffer } = file;
  if (buffer.length === 0 || buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new PaymentProofValidationError();
  }

  const mediaType = identifyMediaType(buffer);
  const originalFileName =
    typeof file.originalFileName === 'string' ? sanitizeOriginalFileName(file.originalFileName) : '';
  if (
    !mediaType ||
    !ALLOWED_MEDIA_TYPES.includes(mediaType) ||
    !originalFileName
  ) {
    throw new PaymentProofValidationError();
  }

  return { mediaType, originalFileName, fileSizeBytes: buffer.length };
}

function validateInput(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    typeof input.bookingId !== 'string' ||
    !input.bookingId.trim() ||
    typeof input.customerId !== 'string' ||
    !input.customerId.trim() ||
    !(input.now instanceof Date) ||
    Number.isNaN(input.now.getTime())
  ) {
    throw new PaymentProofValidationError();
  }
}

class UploadPaymentProof {
  constructor({ bookingReader, fileStorage, paymentProofRepository, bookingPaymentProofNotifier }) {
    this.bookingReader = bookingReader;
    this.fileStorage = fileStorage;
    this.paymentProofRepository = paymentProofRepository;
    this.bookingPaymentProofNotifier = bookingPaymentProofNotifier;
  }

  async execute(input) {
    validateInput(input);
    const { bookingId, customerId, file, now } = input;
    const booking = await this.bookingReader.findForPayment(bookingId.trim());

    if (!booking || booking.ownerId !== customerId.trim()) {
      throw new BookingNotFoundOrNotOwnedError();
    }
    if (booking.acceptsPaymentProof !== true) throw new BookingNotPayableError();

    const fileMetadata = validateFile(file);
    const existingProof = await this.paymentProofRepository.findByBookingId(booking.bookingId);
    const paymentProof =
      existingProof ||
      createPaymentProof({
        booking_id: booking.bookingId,
        cooperative_id: booking.cooperativeId,
      });

    const fileKey = await this.fileStorage.save(file);
    try {
      if (typeof fileKey !== 'string' || !fileKey.trim()) {
        throw new PaymentProofValidationError();
      }

      const uploadedProof = uploadPaymentProof(
        paymentProof,
        {
          file_key: fileKey,
          original_file_name: fileMetadata.originalFileName,
          media_type: fileMetadata.mediaType,
          file_size_bytes: fileMetadata.fileSizeBytes,
        },
        booking.expiresAt,
        now,
      );
      await this.bookingPaymentProofNotifier.markPaymentProofReceived(booking.bookingId);
      const savedProof = await this.paymentProofRepository.save(uploadedProof);
      return { paymentProof: savedProof, expiresAt: booking.expiresAt, total: booking.total };
    } catch (error) {
      await this.fileStorage.delete(fileKey);
      throw error;
    }
  }
}

module.exports = UploadPaymentProof;
