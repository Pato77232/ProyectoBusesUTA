const {
  PaymentProofValidationError,
  PaymentProofUploadDeadlineExpiredError,
  PaymentProofAlreadyUploadedError,
  PaymentProofExpiredError,
  PaymentProofCannotExpireError,
} = require('./payment-proof-error');
const { validatePaymentProofStatus } = require('./payment-proof-status');

const INITIAL_FILE_FIELDS = Object.freeze({
  file_key: null,
  original_file_name: null,
  media_type: null,
  file_size_bytes: null,
  uploaded_at: null,
  expired_at: null,
});

function requiredIdentifier(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PaymentProofValidationError();
  }
  return value.trim();
}

function validDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new PaymentProofValidationError();
  return date;
}

function createPaymentProof(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new PaymentProofValidationError();
  }

  const allowedFields = ['id', 'booking_id', 'cooperative_id', 'status'];
  if (Object.keys(input).some((field) => !allowedFields.includes(field))) {
    throw new PaymentProofValidationError();
  }

  const status = input.status === undefined ? 'AWAITING_UPLOAD' : input.status;
  validatePaymentProofStatus(status);
  if (status !== 'AWAITING_UPLOAD') throw new PaymentProofValidationError();

  return Object.freeze({
    id: input.id === undefined ? null : requiredIdentifier(input.id),
    booking_id: requiredIdentifier(input.booking_id),
    cooperative_id: requiredIdentifier(input.cooperative_id),
    status,
    ...INITIAL_FILE_FIELDS,
  });
}

function uploadPaymentProof(paymentProof, file, paymentDeadlineAt, now = new Date()) {
  if (!paymentProof || !file || typeof file !== 'object' || Array.isArray(file)) {
    throw new PaymentProofValidationError();
  }

  if (paymentProof.status === 'EXPIRED') throw new PaymentProofExpiredError();
  if (paymentProof.status === 'UPLOADED') throw new PaymentProofAlreadyUploadedError();
  validatePaymentProofStatus(paymentProof.status);

  const deadline = validDate(paymentDeadlineAt);
  const uploadedAt = validDate(now);
  if (uploadedAt.getTime() >= deadline.getTime()) {
    throw new PaymentProofUploadDeadlineExpiredError();
  }

  const { file_key, original_file_name, media_type, file_size_bytes } = file;
  if (
    typeof file_key !== 'string' ||
    !file_key.trim() ||
    typeof original_file_name !== 'string' ||
    !original_file_name.trim() ||
    typeof media_type !== 'string' ||
    !media_type.trim() ||
    !Number.isSafeInteger(file_size_bytes) ||
    file_size_bytes <= 0
  ) {
    throw new PaymentProofValidationError();
  }

  return Object.freeze({
    ...paymentProof,
    status: 'UPLOADED',
    file_key: file_key.trim(),
    original_file_name: original_file_name.trim(),
    media_type: media_type.trim(),
    file_size_bytes,
    uploaded_at: uploadedAt,
  });
}

function expirePaymentProof(paymentProof, now = new Date()) {
  if (!paymentProof || typeof paymentProof !== 'object' || Array.isArray(paymentProof)) {
    throw new PaymentProofValidationError();
  }
  validatePaymentProofStatus(paymentProof.status);
  if (paymentProof.status === 'EXPIRED') return paymentProof;
  if (paymentProof.status === 'UPLOADED') throw new PaymentProofCannotExpireError();

  return Object.freeze({
    ...paymentProof,
    status: 'EXPIRED',
    expired_at: validDate(now),
  });
}

module.exports = { createPaymentProof, uploadPaymentProof, expirePaymentProof };
