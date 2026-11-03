const { createBookingPaymentProofNotifier } = require('../../../src/modules/payments');
const UploadPaymentProof = require('../../../src/modules/payments/application/upload-payment-proof.use-case');
const {
  BookingNotificationUncertainError,
  BookingPaymentProofRejectedError,
  PaymentProofUploadDeadlineExpiredError,
} = require('../../../src/modules/payments/domain/payment-proof-error');
const target = { bookingId: 'booking-1', cooperativeId: 'coop-1', paymentProofId: 'proof-1' };
const at = '2026-11-03T14:04:59.999Z';
const accepted = (change = {}) => ({ ...target, outcome: 'ACCEPTED', acceptedAt: at, ...change });
const rejected = () => ({ ...target, outcome: 'REJECTED_EXPIRED', rejectedAt: at });
function harness(result = accepted()) {
  const provider = jest.fn(typeof result === 'function' ? result : async () => result);
  return {
    provider,
    notifier: createBookingPaymentProofNotifier({
      receiptReceiver: { markPaymentProofReceived: provider },
    }),
  };
}
test('exige capacidad interna y no acepta principal o proveedor simulado implícito', () => {
  for (const input of [undefined, {}, { receiptReceiver: { role: 'SERVICE' } }])
    expect(() => createBookingPaymentProofNotifier(input)).toThrow(TypeError);
});
test('aceptación vinculada entrega copia inmutable y una llamada sin renovar fecha', async () => {
  const source = accepted();
  const { provider, notifier } = harness(source);
  const result = await notifier.markPaymentProofReceived(target);
  expect(provider).toHaveBeenCalledWith(target);
  expect(provider).toHaveBeenCalledTimes(1);
  expect(result).toEqual(source);
  expect(result).not.toBe(source);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(provider.mock.calls[0][0])).toBe(true);
  expect(Object.isFrozen(notifier)).toBe(true);
  source.acceptedAt = 'otro';
  expect(result.acceptedAt).toBe(at);
});
test('solo un outcome definitivo vinculado genera el error que autoriza compensación', async () => {
  await expect(
    harness(rejected()).notifier.markPaymentProofReceived(target),
  ).rejects.toBeInstanceOf(PaymentProofUploadDeadlineExpiredError);
});
test.each([
  null,
  undefined,
  {},
  [],
  accepted({ outcome: 'UNKNOWN' }),
  accepted({ bookingId: 'other' }),
  accepted({ cooperativeId: 'other' }),
  accepted({ paymentProofId: 'other' }),
  accepted({ acceptedAt: '2026-11-03T14:04:59Z' }),
  accepted({ acceptedAt: new Date(at) }),
  accepted({ acceptedAt: 'invalid' }),
  accepted({ rejectedAt: at }),
  { ...rejected(), bookingId: 'other' },
  { ...rejected(), rejectedAt: null },
])('respuesta incoherente %# conserva incertidumbre', async (response) => {
  // Undefined debe probarse como respuesta explícita, no como valor por defecto de harness.
  const { notifier } = harness(async () => response);
  await expect(notifier.markPaymentProofReceived(target)).rejects.toBeInstanceOf(
    BookingNotificationUncertainError,
  );
});
test.each([null, {}, [], { ...target, now: at }, { ...target, bookingId: ' ' }])(
  'entrada inválida %# no invoca al proveedor',
  async (input) => {
    const { provider, notifier } = harness();
    await expect(notifier.markPaymentProofReceived(input)).rejects.toBeInstanceOf(
      BookingNotificationUncertainError,
    );
    expect(provider).not.toHaveBeenCalled();
  },
);
test.each([
  new Error('SQL privado o timeout'),
  new BookingPaymentProofRejectedError(),
  new PaymentProofUploadDeadlineExpiredError(),
])('excepción del proveedor %# nunca activa compensación por su clase', async (error) => {
  const { notifier } = harness(async () => {
    throw error;
  });
  await expect(notifier.markPaymentProofReceived(target)).rejects.toMatchObject({
    code: 'BOOKING_NOTIFICATION_UNCERTAIN',
    httpStatus: 503,
  });
  await expect(notifier.markPaymentProofReceived(target)).rejects.not.toThrow('SQL privado');
});
test('captura entrada y método antes de await, conservando this del proveedor', async () => {
  let resolve;
  const receiver = {
    value: target,
    markPaymentProofReceived: jest.fn(function (input) {
      expect(this.value).toEqual(input);
      return new Promise((done) => {
        resolve = done;
      });
    }),
  };
  const notifier = createBookingPaymentProofNotifier({ receiptReceiver: receiver });
  const input = { ...target };
  const pending = notifier.markPaymentProofReceived(input);
  input.cooperativeId = 'other';
  receiver.markPaymentProofReceived = () => {
    throw new Error('No usar reemplazo');
  };
  resolve(accepted());
  expect(await pending).toEqual(accepted());
});
test.each(['accepted', 'expired', 'wrong-link', 'provider-error'])(
  'consumidor legado real clasifica %s sin borrar por incertidumbre',
  async (kind) => {
    const reply =
      kind === 'expired'
        ? rejected()
        : accepted(kind === 'wrong-link' ? { cooperativeId: 'other' } : {});
    const { notifier } = harness(async () => {
      if (kind === 'provider-error') throw new BookingPaymentProofRejectedError();
      return reply;
    });
    const repository = {
      markNotificationAttempted: jest.fn(),
      markNotificationDelivered: jest.fn(),
      deleteByBookingId: jest.fn(),
    };
    const storage = { delete: jest.fn() };
    const upload = new UploadPaymentProof({
      paymentProofRepository: repository,
      fileStorage: storage,
      bookingPaymentProofNotifier: notifier,
    });
    const proof = {
      id: target.paymentProofId,
      booking_id: target.bookingId,
      cooperative_id: target.cooperativeId,
    };
    const operation = upload.notifyBooking(proof, 'private-key');
    if (kind === 'accepted') await expect(operation).resolves.toBeUndefined();
    else
      await expect(operation).rejects.toMatchObject({
        code:
          kind === 'expired'
            ? 'PAYMENT_PROOF_UPLOAD_DEADLINE_EXPIRED'
            : 'BOOKING_NOTIFICATION_UNCERTAIN',
      });
    expect(repository.markNotificationAttempted).toHaveBeenCalledWith(target.bookingId);
    expect(repository.markNotificationDelivered).toHaveBeenCalledTimes(kind === 'accepted' ? 1 : 0);
    expect(repository.deleteByBookingId).toHaveBeenCalledTimes(kind === 'expired' ? 1 : 0);
    expect(storage.delete).toHaveBeenCalledTimes(kind === 'expired' ? 1 : 0);
  },
);

test('captura el outcome una vez antes de validar y no compensa por un getter cambiante', async () => {
  let reads = 0;
  const response = {
    ...target,
    get outcome() {
      reads += 1;
      return reads === 1 ? 'ACCEPTED' : 'REJECTED_EXPIRED';
    },
    acceptedAt: at,
  };
  const { notifier } = harness(async () => response);
  expect(await notifier.markPaymentProofReceived(target)).toEqual(accepted());
  expect(reads).toBe(1);
});
