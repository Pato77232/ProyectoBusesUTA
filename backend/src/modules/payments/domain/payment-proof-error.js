class PaymentProofError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PaymentProofError';
    this.code = code;
  }
}

class PaymentProofValidationError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_VALIDATION_ERROR');
    this.name = 'PaymentProofValidationError';
  }
}

class PaymentProofUploadDeadlineExpiredError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_UPLOAD_DEADLINE_EXPIRED');
    this.name = 'PaymentProofUploadDeadlineExpiredError';
  }
}

class PaymentProofAlreadyUploadedError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_ALREADY_UPLOADED');
    this.name = 'PaymentProofAlreadyUploadedError';
  }
}

class PaymentProofExpiredError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_EXPIRED');
    this.name = 'PaymentProofExpiredError';
  }
}

class PaymentProofCannotExpireError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_CANNOT_EXPIRE');
    this.name = 'PaymentProofCannotExpireError';
  }
}

class BookingNotFoundOrNotOwnedError extends PaymentProofError {
  constructor() {
    super('BOOKING_NOT_FOUND');
    this.name = 'BookingNotFoundOrNotOwnedError';
  }
}

class BookingNotPayableError extends PaymentProofError {
  constructor() {
    super('BOOKING_NOT_PAYABLE');
    this.name = 'BookingNotPayableError';
  }
}

class BookingPaymentProofRejectedError extends PaymentProofError {
  constructor() {
    super('BOOKING_PAYMENT_PROOF_REJECTED');
    this.name = 'BookingPaymentProofRejectedError';
  }
}

module.exports = {
  PaymentProofError,
  PaymentProofValidationError,
  PaymentProofUploadDeadlineExpiredError,
  PaymentProofAlreadyUploadedError,
  PaymentProofExpiredError,
  PaymentProofCannotExpireError,
  BookingNotFoundOrNotOwnedError,
  BookingNotPayableError,
  BookingPaymentProofRejectedError,
};
