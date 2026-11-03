const Notifier = require('../../../src/modules/payments/infrastructure/bookings-payment-proof-notifier');
const Source = require('../../../src/modules/payments/infrastructure/pg-payment-proof-receipt-source');
const { createPaymentReceiptModule } = require('../../../src/modules/payments');
const {
  PaymentProofUploadDeadlineExpiredError,
} = require('../../../src/modules/payments/domain/payment-proof-error');
const { randomUUID } = require('node:crypto');
const input = { bookingId: 'booking', cooperativeId: 'coop', paymentProofId: 'proof' };
const at = '2026-11-03T14:01:00.000Z';
const accepted = { ...input, outcome: 'ACCEPTED', acceptedAt: at };
function setup(result = accepted) {
  const receiver = { markPaymentProofReceived: jest.fn().mockResolvedValue(result) };
  return { receiver, notifier: new Notifier({ receiver }) };
}
test('solo aceptación íntegra satisface el puerto existente', async () => {
  const { notifier, receiver } = setup();
  await expect(notifier.markPaymentProofReceived(input)).resolves.toBeUndefined();
  expect(receiver.markPaymentProofReceived).toHaveBeenCalledWith(input);
  expect(Object.isFrozen(receiver.markPaymentProofReceived.mock.calls[0][0])).toBe(true);
});
test('solo vencimiento confirmado y vinculado autoriza compensación', async () => {
  const { notifier } = setup({ ...input, outcome: 'REJECTED_EXPIRED', rejectedAt: at });
  await expect(notifier.markPaymentProofReceived(input)).rejects.toBeInstanceOf(
    PaymentProofUploadDeadlineExpiredError,
  );
});
test.each([
  undefined,
  null,
  {},
  { ...accepted, outcome: 'UNKNOWN' },
  { ...accepted, bookingId: 'other' },
  { ...accepted, cooperativeId: 'other' },
  { ...accepted, paymentProofId: 'other' },
  { ...accepted, acceptedAt: null },
  { ...accepted, acceptedAt: 'yesterday' },
  { ...accepted, rejectedAt: at },
  { ...input, outcome: 'REJECTED_EXPIRED' },
  { ...input, outcome: 'REJECTED_EXPIRED', rejectedAt: at, cooperativeId: 'other' },
])('resultado no verificable conserva incertidumbre %#', async (result) => {
  const receiver = { markPaymentProofReceived: async () => result };
  await expect(new Notifier({ receiver }).markPaymentProofReceived(input)).rejects.toMatchObject({
    code: 'BOOKING_NOTIFICATION_UNCERTAIN',
  });
});
test.each([
  new Error('SQL privado'),
  new PaymentProofUploadDeadlineExpiredError(),
  { code: 'BOOKING_RECEIPT_LINK_MISMATCH' },
])('excepción del proveedor nunca certifica compensación %#', async (error) => {
  const { notifier, receiver } = setup();
  receiver.markPaymentProofReceived.mockRejectedValue(error);
  await expect(notifier.markPaymentProofReceived(input)).rejects.toMatchObject({
    code: 'BOOKING_NOTIFICATION_UNCERTAIN',
  });
});
test.each([null, {}, { ...input, role: 'SERVICE' }, { ...input, bookingId: ' ' }])(
  'entrada inválida no llama al proveedor %#',
  async (value) => {
    const { notifier, receiver } = setup();
    await expect(notifier.markPaymentProofReceived(value)).rejects.toMatchObject({
      code: 'PAYMENT_PROOF_VALIDATION_ERROR',
    });
    expect(receiver.markPaymentProofReceived).not.toHaveBeenCalled();
  },
);
test('la petición no cambia durante la espera del proveedor', async () => {
  const mutable = { ...input };
  const receiver = {
    async markPaymentProofReceived(target) {
      mutable.cooperativeId = 'other';
      await Promise.resolve();
      return { ...target, outcome: 'ACCEPTED', acceptedAt: at };
    },
  };
  await expect(
    new Notifier({ receiver }).markPaymentProofReceived(mutable),
  ).resolves.toBeUndefined();
});
test('fuente ausente devuelve null y fallo técnico conserva error seguro', async () => {
  const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const source = new Source({ pool });
  await expect(source.findForBookingReceipt({ paymentProofId: randomUUID() })).resolves.toBeNull();
  pool.query.mockRejectedValue(new Error('SQL privado'));
  await expect(
    source.findForBookingReceipt({ paymentProofId: randomUUID() }),
  ).rejects.toMatchObject({ code: 'BOOKING_NOTIFICATION_UNCERTAIN' });
});
test.each([
  {},
  null,
  { paymentProofId: 'invalid' },
  { paymentProofId: randomUUID(), role: 'SERVICE' },
])('consulta estricta no toca persistencia %#', async (value) => {
  const pool = { query: jest.fn() };
  await expect(new Source({ pool }).findForBookingReceipt(value)).rejects.toMatchObject({
    code: 'PAYMENT_PROOF_VALIDATION_ERROR',
  });
  expect(pool.query).not.toHaveBeenCalled();
});
test('composición requiere proveedor real sin fallback simulado', () => {
  expect(() => createPaymentReceiptModule()).toThrow(TypeError);
  expect(() => createPaymentReceiptModule({ pool: { query: jest.fn() } })).toThrow(TypeError);
  expect(() => new Notifier({ receiver: {} })).toThrow(TypeError);
});
