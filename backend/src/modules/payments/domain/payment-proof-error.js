class PaymentProofError extends Error {
  constructor(code, httpStatus = 500, message = code) {
    super(message);
    this.name = 'PaymentProofError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

class PaymentProofValidationError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_VALIDATION_ERROR', 400, 'Los datos del comprobante no son válidos.');
    this.name = 'PaymentProofValidationError';
  }
}

class PaymentProofUploadDeadlineExpiredError extends PaymentProofError {
  constructor() {
    super(
      'PAYMENT_PROOF_UPLOAD_DEADLINE_EXPIRED',
      409,
      'El plazo para enviar el comprobante venció.',
    );
    this.name = 'PaymentProofUploadDeadlineExpiredError';
  }
}

class PaymentProofAlreadyUploadedError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_ALREADY_UPLOADED', 409, 'La reserva ya tiene un comprobante cargado.');
    this.name = 'PaymentProofAlreadyUploadedError';
  }
}

class PaymentProofExpiredError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_EXPIRED', 409, 'El comprobante ya expiró.');
    this.name = 'PaymentProofExpiredError';
  }
}

class PaymentProofCannotExpireError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_CANNOT_EXPIRE', 409, 'Un comprobante cargado no puede expirar.');
    this.name = 'PaymentProofCannotExpireError';
  }
}

class BookingNotFoundOrNotOwnedError extends PaymentProofError {
  constructor() {
    super('BOOKING_NOT_FOUND', 404, 'La reserva no existe o no pertenece al cliente.');
    this.name = 'BookingNotFoundOrNotOwnedError';
  }
}

class BookingNotPayableError extends PaymentProofError {
  constructor() {
    super('BOOKING_NOT_PAYABLE', 409, 'La reserva no admite comprobantes.');
    this.name = 'BookingNotPayableError';
  }
}

class BookingPaymentProofRejectedError extends PaymentProofError {
  constructor() {
    super(
      'BOOKING_PAYMENT_PROOF_REJECTED',
      409,
      'La reserva rechazó definitivamente el comprobante.',
    );
    this.name = 'BookingPaymentProofRejectedError';
  }
}

class BookingNotificationUncertainError extends PaymentProofError {
  constructor() {
    super(
      'BOOKING_NOTIFICATION_UNCERTAIN',
      503,
      'No se pudo confirmar la recepción; el comprobante quedó guardado para reintento.',
    );
    this.name = 'BookingNotificationUncertainError';
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
  BookingNotificationUncertainError,
};
