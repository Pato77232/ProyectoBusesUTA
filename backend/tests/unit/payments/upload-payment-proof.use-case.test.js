const UploadPaymentProof = require('../../../src/modules/payments/application/upload-payment-proof.use-case');
const {
  BookingNotFoundOrNotOwnedError,
  BookingNotPayableError,
  PaymentProofValidationError,
  PaymentProofUploadDeadlineExpiredError,
} = require('../../../src/modules/payments/domain/payment-proof-error');

const NOW = new Date('2026-10-25T12:04:00.000Z');
const BOOKING = Object.freeze({
  bookingId: 'booking-1',
  ownerId: 'customer-1',
  cooperativeId: 'coop-from-booking',
  status: 'ESTADO_DE_BOOKINGS',
  acceptsPaymentProof: true,
  expiresAt: new Date('2026-10-25T12:05:00.000Z'),
  total: 2550,
});
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const FILE = { buffer: PNG_BUFFER, originalFileName: 'comprobante.png' };

function createHarness({ booking = BOOKING, proof = null, saveError, notifyError } = {}) {
  const files = new Map();
  const proofs = new Map(proof ? [[booking.bookingId, proof]] : []);
  const bookingReader = {
    findForPayment: jest.fn(async () => booking),
  };
  const fileStorage = {
    save: jest.fn(async (file) => {
      const key = `opaque-${files.size + 1}`;
      files.set(key, file);
      return key;
    }),
    delete: jest.fn(async (key) => files.delete(key)),
  };
  const paymentProofRepository = {
    findByBookingId: jest.fn(async (bookingId) => proofs.get(bookingId) || null),
    save: jest.fn(async (paymentProof) => {
      if (saveError) throw saveError;
      proofs.set(paymentProof.booking_id, paymentProof);
      return paymentProof;
    }),
  };
  const bookingPaymentProofNotifier = {
    markPaymentProofReceived: jest.fn(async () => {
      if (notifyError) throw notifyError;
    }),
  };
  const useCase = new UploadPaymentProof({
    bookingReader,
    fileStorage,
    paymentProofRepository,
    bookingPaymentProofNotifier,
  });

  return { useCase, files, proofs, bookingReader, fileStorage, paymentProofRepository, bookingPaymentProofNotifier };
}

function createInput(overrides = {}) {
  return { bookingId: BOOKING.bookingId, customerId: BOOKING.ownerId, file: FILE, now: NOW, ...overrides };
}

test('carga el comprobante usando la cooperativa, fecha límite y total de la reserva', async () => {
  // Arrange
  const harness = createHarness();

  // Act
  const result = await harness.useCase.execute(createInput({ cooperativeId: 'coop-from-request' }));

  // Assert
  expect(result.paymentProof).toMatchObject({
    booking_id: BOOKING.bookingId,
    cooperative_id: BOOKING.cooperativeId,
    status: 'UPLOADED',
    media_type: 'image/png',
    file_size_bytes: PNG_BUFFER.length,
    original_file_name: FILE.originalFileName,
  });
  expect(result.expiresAt).toBe(BOOKING.expiresAt);
  expect(result.total).toBe(BOOKING.total);
  expect(harness.bookingReader.findForPayment).toHaveBeenCalledWith(BOOKING.bookingId);
  expect(harness.bookingPaymentProofNotifier.markPaymentProofReceived).toHaveBeenCalledWith(
    BOOKING.bookingId,
  );
  expect(
    harness.bookingPaymentProofNotifier.markPaymentProofReceived.mock.invocationCallOrder[0],
  ).toBeLessThan(harness.paymentProofRepository.save.mock.invocationCallOrder[0]);
  expect(harness.files.size).toBe(1);
});

test.each([
  ['no existe', null, 'customer-1'],
  ['pertenece a otro cliente', BOOKING, 'customer-ajeno'],
])('responde igual si la reserva %s', async (description, booking, customerId) => {
  // Arrange
  const harness = createHarness({ booking });

  // Act / Assert
  await expect(harness.useCase.execute(createInput({ customerId }))).rejects.toBeInstanceOf(
    BookingNotFoundOrNotOwnedError,
  );
  expect(harness.fileStorage.save).not.toHaveBeenCalled();
});

test('acepta un archivo que mide exactamente 5 MiB', async () => {
  // Arrange
  const maxSizeFile = {
    buffer: Buffer.concat([PNG_BUFFER.subarray(0, 8), Buffer.alloc(5 * 1024 * 1024 - 8)]),
    originalFileName: 'comprobante.png',
  };
  const harness = createHarness();

  // Act
  const result = await harness.useCase.execute(createInput({ file: maxSizeFile }));

  // Assert
  expect(result.paymentProof.file_size_bytes).toBe(5 * 1024 * 1024);
  expect(harness.files.size).toBe(1);
});

test('rechaza reservas cuando bookings indica que no admiten comprobante', async () => {
  // Arrange
  const harness = createHarness({ booking: { ...BOOKING, acceptsPaymentProof: false } });

  // Act / Assert
  await expect(harness.useCase.execute(createInput())).rejects.toBeInstanceOf(BookingNotPayableError);
  expect(harness.fileStorage.save).not.toHaveBeenCalled();
});

test.each([
  ['sin contenido', { ...FILE, buffer: Buffer.alloc(0) }],
  ['mayor a 5 MiB', { ...FILE, buffer: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(5 * 1024 * 1024)]) }],
  ['contenido que no es PDF, JPEG ni PNG', { ...FILE, buffer: Buffer.from('no es un archivo permitido') }],
  ['sin nombre original', { buffer: PNG_BUFFER }],
])('rechaza un archivo %s antes de guardarlo', async (description, file) => {
  // Arrange
  const harness = createHarness();

  // Act / Assert
  await expect(harness.useCase.execute(createInput({ file }))).rejects.toBeInstanceOf(
    PaymentProofValidationError,
  );
  expect(harness.fileStorage.save).not.toHaveBeenCalled();
});

test('elimina el archivo si falla la persistencia del comprobante', async () => {
  // Arrange
  const harness = createHarness({ saveError: new Error('fallo de persistencia') });

  // Act / Assert
  await expect(harness.useCase.execute(createInput())).rejects.toThrow('fallo de persistencia');
  expect(harness.fileStorage.delete).toHaveBeenCalledWith('opaque-1');
  expect(harness.files.size).toBe(0);
});

test('si reservas rechaza el aviso por plazo vencido no persiste y elimina el archivo', async () => {
  // Arrange
  const deadlineError = new PaymentProofUploadDeadlineExpiredError();
  const harness = createHarness({ notifyError: deadlineError });

  // Act / Assert
  await expect(harness.useCase.execute(createInput())).rejects.toBe(deadlineError);
  expect(harness.paymentProofRepository.save).not.toHaveBeenCalled();
  expect(harness.fileStorage.delete).toHaveBeenCalledWith('opaque-1');
  expect(harness.files.size).toBe(0);
});

test('exige un reloj explícito', async () => {
  // Arrange
  const harness = createHarness();

  // Act / Assert
  await expect(harness.useCase.execute(createInput({ now: undefined }))).rejects.toBeInstanceOf(
    PaymentProofValidationError,
  );
  expect(harness.fileStorage.save).not.toHaveBeenCalled();
});
