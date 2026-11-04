const { createPaymentProof, uploadPaymentProof } = require('../domain/payment-proof');
const {
  BookingNotFoundOrNotOwnedError,
  BookingNotPayableError,
  PaymentProofValidationError,
  BookingPaymentProofRejectedError,
  PaymentProofUploadDeadlineExpiredError,
  BookingNotificationUncertainError,
  PaymentProofPersistenceUncertainError,
  PaymentProofReconciliationRequiredError,
} = require('../domain/payment-proof-error');
const { MAX_FILE_SIZE_BYTES } = require('../domain/payment-proof-constraints');

const ALLOWED_MEDIA_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png']);

function identifyMediaType(buffer) {
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';

  const isJpeg =
    buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
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
    typeof file.originalFileName === 'string'
      ? sanitizeOriginalFileName(file.originalFileName)
      : '';
  if (!mediaType || !ALLOWED_MEDIA_TYPES.includes(mediaType) || !originalFileName) {
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
    !input.authContext ||
    typeof input.authContext !== 'object' ||
    Array.isArray(input.authContext) ||
    typeof input.authContext.userId !== 'string' ||
    !input.authContext.userId.trim() ||
    input.authContext.role !== 'CUSTOMER' ||
    input.authContext.cooperativeId !== null ||
    !(input.now instanceof Date) ||
    Number.isNaN(input.now.getTime())
  ) {
    throw new PaymentProofValidationError();
  }
}

function isDefinitiveBookingRejection(error) {
  return (
    error instanceof BookingPaymentProofRejectedError ||
    error instanceof PaymentProofUploadDeadlineExpiredError
  );
}

class UploadPaymentProof {
  constructor({ bookingReader, fileStorage, paymentProofRepository, bookingPaymentProofNotifier }) {
    this.bookingReader = bookingReader;
    this.fileStorage = fileStorage;
    this.paymentProofRepository = paymentProofRepository;
    this.bookingPaymentProofNotifier = bookingPaymentProofNotifier;
  }

  async notifyBooking(paymentProof, fileKey) {
    const {
      booking_id: bookingId,
      cooperative_id: cooperativeId,
      id: paymentProofId,
    } = paymentProof;
    try {
      await this.paymentProofRepository.markNotificationAttempted(bookingId);
      await this.bookingPaymentProofNotifier.markPaymentProofReceived({
        bookingId,
        cooperativeId,
        paymentProofId,
      });
      await this.paymentProofRepository.markNotificationDelivered(bookingId);
    } catch (error) {
      if (isDefinitiveBookingRejection(error)) {
        await this.paymentProofRepository.deleteByBookingId(bookingId);
        await this.fileStorage.delete(fileKey);
        throw error;
      }
      throw new BookingNotificationUncertainError();
    }
  }

  async execute(input) {
    validateInput(input);
    const bookingId = input.bookingId;
    const authContext = Object.freeze({
      userId: input.authContext.userId,
      role: input.authContext.role,
      cooperativeId: input.authContext.cooperativeId,
    });
    const customerId = authContext.userId;
    const now = new Date(input.now.getTime());
    const booking = await this.bookingReader.findForPayment(
      { bookingId, purpose: 'UPLOAD_PROOF' },
      authContext,
    );

    if (!booking || booking.ownerId !== customerId) {
      throw new BookingNotFoundOrNotOwnedError();
    }
    const existingProof = await this.paymentProofRepository.findByBookingId(booking.bookingId);
    if (existingProof?.status === 'UPLOADED') {
      if (
        existingProof.upload_authorized_by !== customerId ||
        !(existingProof.upload_authorized_at instanceof Date) ||
        Number.isNaN(existingProof.upload_authorized_at.getTime())
      ) {
        throw new PaymentProofReconciliationRequiredError();
      }
      await this.notifyBooking(existingProof, existingProof.file_key);
      return { paymentProof: existingProof, expiresAt: booking.expiresAt, total: booking.total };
    }
    if (booking.acceptsPaymentProof !== true) throw new BookingNotPayableError();

    const file = input.file;
    const fileMetadata = validateFile(file);

    const paymentProof =
      existingProof ||
      createPaymentProof({
        booking_id: booking.bookingId,
        cooperative_id: booking.cooperativeId,
      });

    const fileKey = await this.fileStorage.save(file);
    let uploadedProof;
    let savedProof;
    try {
      if (typeof fileKey !== 'string' || !fileKey.trim()) {
        throw new PaymentProofValidationError();
      }

      uploadedProof = uploadPaymentProof(
        paymentProof,
        {
          file_key: fileKey,
          original_file_name: fileMetadata.originalFileName,
          media_type: fileMetadata.mediaType,
          file_size_bytes: fileMetadata.fileSizeBytes,
        },
        booking.expiresAt,
        now,
        { upload_authorized_by: customerId, upload_authorized_at: now },
      );
      savedProof = await this.paymentProofRepository.saveWithPendingNotification(uploadedProof);
    } catch (error) {
      if (!(error instanceof PaymentProofPersistenceUncertainError)) {
        await this.fileStorage.delete(fileKey);
      }
      throw error;
    }

    await this.notifyBooking(savedProof, fileKey);

    return { paymentProof: savedProof, expiresAt: booking.expiresAt, total: booking.total };
  }
}

module.exports = UploadPaymentProof;
