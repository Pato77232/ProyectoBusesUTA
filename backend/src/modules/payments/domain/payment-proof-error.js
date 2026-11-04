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

class PaymentProofNotFoundError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_NOT_FOUND', 404, 'El comprobante no existe.');
    this.name = 'PaymentProofNotFoundError';
  }
}

class PaymentProofNotPendingError extends PaymentProofError {
  constructor() {
    super('PAYMENT_PROOF_NOT_PENDING', 409, 'El comprobante ya no está pendiente de aprobación.');
    this.name = 'PaymentProofNotPendingError';
  }
}

class PaymentProofTotalUnavailableError extends PaymentProofError {
  constructor() {
    super(
      'PAYMENT_PROOF_TOTAL_UNAVAILABLE',
      503,
      'No se pudo consultar el total vigente de la reserva; intente nuevamente.',
    );
    this.name = 'PaymentProofTotalUnavailableError';
  }
}

class BookingSaleRejectedError extends PaymentProofError {
  constructor() {
    super('BOOKING_SALE_REJECTED', 409, 'La reserva no puede confirmarse como venta.');
    this.name = 'BookingSaleRejectedError';
  }
}

class BookingSaleUncertainError extends PaymentProofError {
  constructor() {
    super(
      'BOOKING_SALE_UNCERTAIN',
      503,
      'No se pudo confirmar el resultado; la aprobación puede reintentarse.',
    );
    this.name = 'BookingSaleUncertainError';
  }
}

class PaymentProofApprovalPersistenceUncertainError extends PaymentProofError {
  constructor() {
    super(
      'PAYMENT_PROOF_APPROVAL_PERSISTENCE_UNCERTAIN',
      503,
      'La venta puede estar confirmada; reintente la aprobación con el mismo comprobante.',
    );
    this.name = 'PaymentProofApprovalPersistenceUncertainError';
  }
}

class PaymentProofApprovalIntentPersistenceError extends PaymentProofError {
  constructor() {
    super(
      'PAYMENT_PROOF_APPROVAL_INTENT_PERSISTENCE_FAILED',
      503,
      'No se pudo registrar la intención de aprobación; reintente la solicitud.',
    );
    this.name = 'PaymentProofApprovalIntentPersistenceError';
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

class PaymentProofReconciliationRequiredError extends PaymentProofError {
  constructor() {
    super(
      'PAYMENT_PROOF_RECONCILIATION_REQUIRED',
      409,
      'El comprobante requiere conciliación antes de reintentarse.',
    );
    this.name = 'PaymentProofReconciliationRequiredError';
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

class PaymentProofPersistenceUncertainError extends PaymentProofError {
  constructor() {
    super(
      'PAYMENT_PROOF_PERSISTENCE_UNCERTAIN',
      503,
      'No se pudo confirmar el guardado; el comprobante queda disponible para reintento.',
    );
    this.name = 'PaymentProofPersistenceUncertainError';
  }
}

module.exports = {
  PaymentProofError,
  PaymentProofValidationError,
  PaymentProofUploadDeadlineExpiredError,
  PaymentProofAlreadyUploadedError,
  PaymentProofExpiredError,
  PaymentProofCannotExpireError,
  PaymentProofNotFoundError,
  PaymentProofNotPendingError,
  PaymentProofTotalUnavailableError,
  BookingSaleRejectedError,
  BookingSaleUncertainError,
  PaymentProofApprovalPersistenceUncertainError,
  PaymentProofApprovalIntentPersistenceError,
  BookingNotFoundOrNotOwnedError,
  BookingNotPayableError,
  PaymentProofReconciliationRequiredError,
  BookingPaymentProofRejectedError,
  BookingNotificationUncertainError,
  PaymentProofPersistenceUncertainError,
};
