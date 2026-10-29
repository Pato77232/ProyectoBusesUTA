const {
  createPaymentProof,
  uploadPaymentProof,
  expirePaymentProof,
} = require('../../../src/modules/payments/domain/payment-proof');
const {
  PaymentProofValidationError,
  PaymentProofUploadDeadlineExpiredError,
  PaymentProofAlreadyUploadedError,
  PaymentProofExpiredError,
  PaymentProofCannotExpireError,
} = require('../../../src/modules/payments/domain/payment-proof-error');

const validInput = { id: 'proof-1', booking_id: 'booking-1', cooperative_id: 'coop-1' };
const validFile = {
  file_key: 'private/proof-1',
  original_file_name: 'transferencia.pdf',
  media_type: 'application/pdf',
  file_size_bytes: 2048,
};

test('crea un comprobante AWAITING_UPLOAD sin archivo asociado', () => {
  // Arrange / Act
  const paymentProof = createPaymentProof(validInput);

  // Assert
  expect(paymentProof).toEqual({
    ...validInput,
    status: 'AWAITING_UPLOAD',
    file_key: null,
    original_file_name: null,
    media_type: null,
    file_size_bytes: null,
    uploaded_at: null,
    expired_at: null,
  });
  expect(Object.isFrozen(paymentProof)).toBe(true);
});

test.each([null, undefined, [], 'proof', { booking_id: 'booking-1' }, { ...validInput, unexpected: true }])(
  'rechaza datos inválidos al crear el comprobante: %j',
  (input) => {
    // Arrange / Act / Assert
    expect(() => createPaymentProof(input)).toThrow(PaymentProofValidationError);
  },
);

test('rechaza estados iniciales distintos de AWAITING_UPLOAD', () => {
  // Arrange / Act / Assert
  expect(() => createPaymentProof({ ...validInput, status: 'UPLOADED' })).toThrow(
    PaymentProofValidationError,
  );
  expect(() => createPaymentProof({ ...validInput, status: 'UNKNOWN' })).toThrow(
    PaymentProofValidationError,
  );
});

test('cambia a UPLOADED al recibir archivo antes de la fecha límite', () => {
  // Arrange
  const paymentProof = createPaymentProof(validInput);
  const deadline = new Date('2026-10-25T12:05:00.000Z');
  const now = new Date('2026-10-25T12:04:00.000Z');

  // Act
  const uploaded = uploadPaymentProof(paymentProof, validFile, deadline, now);

  // Assert
  expect(uploaded).toMatchObject({
    status: 'UPLOADED',
    ...validFile,
    uploaded_at: now,
  });
  expect(paymentProof.status).toBe('AWAITING_UPLOAD');
});

test.each([
  new Date('2026-10-25T12:05:00.000Z'),
  new Date('2026-10-25T12:06:00.000Z'),
])('rechaza la carga cuando now >= payment_deadline_at: %s', (now) => {
  // Arrange
  const paymentProof = createPaymentProof(validInput);
  const deadline = new Date('2026-10-25T12:05:00.000Z');

  // Act / Assert
  expect(() => uploadPaymentProof(paymentProof, validFile, deadline, now)).toThrow(
    PaymentProofUploadDeadlineExpiredError,
  );
});

test('rechaza archivos incompletos sin cambiar el estado original', () => {
  // Arrange
  const paymentProof = createPaymentProof(validInput);
  const file = { ...validFile, file_size_bytes: 0 };

  // Act / Assert
  expect(() =>
    uploadPaymentProof(paymentProof, file, new Date('2026-10-25T12:05:00.000Z'), new Date('2026-10-25T12:04:00.000Z')),
  ).toThrow(PaymentProofValidationError);
  expect(paymentProof.status).toBe('AWAITING_UPLOAD');
});

test('no permite cargar un comprobante que ya fue cargado o expiró', () => {
  // Arrange
  const awaiting = createPaymentProof(validInput);
  const uploaded = uploadPaymentProof(
    awaiting,
    validFile,
    new Date('2026-10-25T12:05:00.000Z'),
    new Date('2026-10-25T12:04:00.000Z'),
  );
  const expired = expirePaymentProof(awaiting, new Date('2026-10-25T12:06:00.000Z'));
  const deadline = new Date('2026-10-25T12:07:00.000Z');
  const now = new Date('2026-10-25T12:06:00.000Z');

  // Act / Assert
  expect(() => uploadPaymentProof(uploaded, validFile, deadline, now)).toThrow(
    PaymentProofAlreadyUploadedError,
  );
  expect(() => uploadPaymentProof(expired, validFile, deadline, now)).toThrow(
    PaymentProofExpiredError,
  );
});

test('expira un comprobante sin archivo y conserva la fecha de expiración', () => {
  // Arrange
  const paymentProof = createPaymentProof(validInput);
  const now = new Date('2026-10-25T12:06:00.000Z');

  // Act
  const expired = expirePaymentProof(paymentProof, now);

  // Assert
  expect(expired.status).toBe('EXPIRED');
  expect(expired.expired_at).toEqual(now);
  expect(expired.file_key).toBeNull();
  expect(paymentProof.status).toBe('AWAITING_UPLOAD');
});

test('repetir la expiración es idempotente y no expira un comprobante cargado', () => {
  // Arrange
  const paymentProof = createPaymentProof(validInput);
  const expired = expirePaymentProof(paymentProof, new Date('2026-10-25T12:06:00.000Z'));
  const uploaded = uploadPaymentProof(
    paymentProof,
    validFile,
    new Date('2026-10-25T12:05:00.000Z'),
    new Date('2026-10-25T12:04:00.000Z'),
  );

  // Act / Assert
  expect(expirePaymentProof(expired, new Date('2026-10-25T12:07:00.000Z'))).toBe(expired);
  expect(() => expirePaymentProof(uploaded)).toThrow(PaymentProofCannotExpireError);
});
