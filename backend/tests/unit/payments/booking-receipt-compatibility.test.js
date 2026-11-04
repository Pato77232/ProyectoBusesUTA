const Notifier = require('../../../src/modules/payments/infrastructure/bookings-payment-proof-notifier');
const { createBookingPaymentProofNotifier } = require('../../../src/modules/payments');
const {
  PaymentProofUploadDeadlineExpiredError,
} = require('../../../src/modules/payments/domain/payment-proof-error');
const input = { bookingId: 'booking', cooperativeId: 'coop', paymentProofId: 'proof' };
const at = '2026-11-03T14:01:00.000Z';
function create(kind, receiver) {
  return kind === 'class'
    ? new Notifier({ receiver })
    : createBookingPaymentProofNotifier({ receiptReceiver: receiver });
}
test.each(
  ['class', 'factory'].flatMap((kind) => ['input', 'result'].map((phase) => [kind, phase])),
)('%s: un getter de %s que lanza plazo no certifica compensación', async (kind, phase) => {
  const fault = {
    ...input,
    get bookingId() {
      throw new PaymentProofUploadDeadlineExpiredError();
    },
  };
  const receiver = {
    markPaymentProofReceived: jest.fn(async () =>
      phase === 'result' ? fault : { ...input, outcome: 'ACCEPTED', acceptedAt: at },
    ),
  };
  await expect(
    create(kind, receiver).markPaymentProofReceived(phase === 'input' ? fault : input),
  ).rejects.toMatchObject({ code: 'BOOKING_NOTIFICATION_UNCERTAIN' });
  expect(receiver.markPaymentProofReceived).toHaveBeenCalledTimes(phase === 'input' ? 0 : 1);
});
test('puerto integrado captura el outcome una sola vez y conserva retorno undefined', async () => {
  let reads = 0;
  const result = {
    ...input,
    get outcome() {
      reads += 1;
      return reads === 1 ? 'ACCEPTED' : 'REJECTED_EXPIRED';
    },
    acceptedAt: at,
  };
  await expect(
    new Notifier({
      receiver: { markPaymentProofReceived: async () => result },
    }).markPaymentProofReceived(input),
  ).resolves.toBeUndefined();
  expect(reads).toBe(1);
});
test('puerto integrado captura cada ID una vez antes de validarlo', async () => {
  let reads = 0;
  const request = {
    ...input,
    get bookingId() {
      reads += 1;
      return reads === 1 ? input.bookingId : 'other';
    },
  };
  const receiver = {
    markPaymentProofReceived: jest.fn(async (value) => ({
      ...value,
      outcome: 'ACCEPTED',
      acceptedAt: at,
    })),
  };
  await new Notifier({ receiver }).markPaymentProofReceived(request);
  expect(reads).toBe(1);
  expect(receiver.markPaymentProofReceived).toHaveBeenCalledWith(input);
});
test('puerto integrado captura el método ligado sin usar reemplazos posteriores', async () => {
  const receiver = {
    tag: 'original',
    markPaymentProofReceived: jest.fn(async function (value) {
      expect(this.tag).toBe('original');
      return { ...value, outcome: 'ACCEPTED', acceptedAt: at };
    }),
  };
  const notifier = new Notifier({ receiver });
  const original = receiver.markPaymentProofReceived;
  receiver.markPaymentProofReceived = () => {
    throw new Error('No usar reemplazo');
  };
  await expect(notifier.markPaymentProofReceived(input)).resolves.toBeUndefined();
  expect(original).toHaveBeenCalledTimes(1);
});
