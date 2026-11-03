const {
  request,
  verifiedSource,
  receiptResult,
  expireDecision,
  receiveDecision,
} = require('../../../src/modules/bookings/domain/booking-lifecycle');
const receivePaymentProof = require('../../../src/modules/bookings/application/receive-payment-proof.use-case');
const target = { bookingId: 'booking-1', cooperativeId: 'coop-1', paymentProofId: 'proof-1' };
const start = new Date('2026-11-03T14:00:00Z');
const deadline = new Date('2026-11-03T14:05:00Z');
const booking = (changes = {}) => ({
  bookingId: target.bookingId,
  cooperativeId: target.cooperativeId,
  tripId: 'trip-1',
  status: 'PENDING_PAYMENT',
  fromPosition: 0,
  toPosition: 2,
  proofWindowStartedAt: start,
  proofWindowSeconds: 300,
  expiresAt: deadline,
  expiredAt: null,
  proofReceptionState: 'NOT_RECEIVED',
  acceptedProofId: null,
  proofReceivedAt: null,
  passengerCount: 2,
  ...changes,
});
const seats = () =>
  [1, 2].map(() => ({ status: 'RESERVED', active: true, fromPosition: 0, toPosition: 2 }));
const source = (changes = {}) => ({
  ...target,
  status: 'UPLOADED',
  notificationStatus: 'PENDING',
  uploadedAt: start.toISOString(),
  ...changes,
});

test('captura solo tres IDs opacos y exige entrada exacta', () => {
  expect(request(target)).toEqual(target);
  expect(Object.isFrozen(request(target))).toBe(true);
  expect(request({ bookingId: 'opaque' }, false)).toEqual({ bookingId: 'opaque' });
});
test.each([
  null,
  {},
  { ...target, role: 'SERVICE' },
  { ...target, paymentProofId: '' },
  { ...target, bookingId: ' ' },
  [],
])('rechaza payload inválido %#', (input) => {
  expect(() => request(input)).toThrow(
    expect.objectContaining({ code: 'BOOKING_VALIDATION_ERROR' }),
  );
});
test.each([
  null,
  source({ bookingId: 'other' }),
  source({ cooperativeId: 'other' }),
  source({ paymentProofId: 'other' }),
  source({ status: 'AWAITING_UPLOAD' }),
  source({ notificationStatus: 'DELIVERED' }),
  source({ uploadedAt: 'yesterday' }),
])('rechaza fuente sin hechos elegibles %#', (input) => {
  expect(() => verifiedSource(input, target)).toThrow(
    expect.objectContaining({ code: 'BOOKING_RECEIPT_SOURCE_MISMATCH' }),
  );
});
test('acepta fuente persistida mínima sin convertirla en precio o reloj', () => {
  expect(() => verifiedSource(source(), target)).not.toThrow();
});
test.each([-1, 0, 1])('recepción en el límite %+i ms', (offset) => {
  const now = new Date(deadline.getTime() + offset);
  const result = receiveDecision(booking(), seats(), target, now);
  expect(result.outcome).toBe(offset < 0 ? 'ACCEPTED' : 'REJECTED_EXPIRED');
  expect(result.acceptedAt || result.rejectedAt).toBe(now.toISOString());
});
test.each([-1, 0, 1])('expiración en el límite %+i ms', (offset) => {
  const result = expireDecision(booking(), seats(), new Date(deadline.getTime() + offset));
  expect(result.outcome).toBe(offset < 0 ? 'NOT_DUE' : 'EXPIRED');
});
test('recepción aceptada conserva asientos después del plazo', () => {
  const row = booking({
    proofReceptionState: 'RECEIVED',
    acceptedProofId: 'proof-1',
    proofReceivedAt: new Date(start.getTime() + 1),
  });
  expect(expireDecision(row, seats(), undefined).outcome).toBe('PROOF_RECEIVED');
  expect(() => receiveDecision(row, seats(), target, deadline)).toThrow(
    expect.objectContaining({ code: 'BOOKING_RECEIPT_LINK_MISMATCH' }),
  );
});
test('expiración persistida se recupera sin reloj nuevo', () => {
  const expiredAt = new Date(deadline.getTime() + 10);
  const result = expireDecision(
    booking({ status: 'EXPIRED', expiredAt }),
    seats().map((s) => ({ ...s, active: false })),
    undefined,
  );
  expect(result).toEqual({
    outcome: 'EXPIRED',
    bookingId: target.bookingId,
    expiredAt: expiredAt.toISOString(),
  });
});
test.each([
  { proofReceptionState: 'UNKNOWN' },
  { proofWindowSeconds: 179 },
  { proofWindowSeconds: 301 },
  { status: 'SOLD' },
  { expiredAt: deadline },
  { proofReceivedAt: start },
  { acceptedProofId: 'unexpected' },
  { expiresAt: new Date(deadline.getTime() + 1) },
  { passengerCount: 3 },
])('no decide con datos incoherentes %#', (changes) => {
  expect(() => expireDecision(booking(changes), seats(), deadline)).toThrow(
    expect.objectContaining({ code: 'BOOKING_DATA_INTEGRITY_ERROR' }),
  );
});
test.each(['sold', 'inactive', 'range', 'missing'])(
  'no libera asignación incoherente %s',
  (kind) => {
    const allocations = seats();
    if (kind === 'sold') allocations[1].status = 'SOLD';
    if (kind === 'inactive') allocations[1].active = false;
    if (kind === 'range') allocations[1].toPosition = 3;
    if (kind === 'missing') allocations.pop();
    expect(() => expireDecision(booking(), allocations, deadline)).toThrow(
      expect.objectContaining({ code: 'BOOKING_DATA_INTEGRITY_ERROR' }),
    );
  },
);
test('rechaza reloj anterior al inicio o inválido', () => {
  for (const now of [new Date(start.getTime() - 1), new Date('invalid'), null]) {
    expect(() => receiveDecision(booking(), seats(), target, now)).toThrow(
      expect.objectContaining({ code: 'BOOKING_DATA_INTEGRITY_ERROR' }),
    );
  }
});
test('resultado anterior conserva fecha y no revela vínculos de otra operación', () => {
  const row = { ...target, outcome: 'ACCEPTED', decidedAt: start };
  expect(receiptResult(row, target).acceptedAt).toBe(start.toISOString());
  expect(() => receiptResult(row, { ...target, cooperativeId: 'other' })).toThrow(
    expect.objectContaining({ code: 'BOOKING_RECEIPT_LINK_MISMATCH' }),
  );
});
test('factory exige una fuente, no acepta un principal como autorización', () => {
  expect(() =>
    receivePaymentProof({ receiptSource: { role: 'SERVICE', authorized: true } }),
  ).toThrow(TypeError);
});
test('replay evita consultar fuente, renovar reloj o escribir otra vez', async () => {
  const previous = Object.freeze({
    ...target,
    outcome: 'ACCEPTED',
    acceptedAt: start.toISOString(),
  });
  const repository = { findReceipt: jest.fn().mockResolvedValue(previous), receive: jest.fn() };
  const receiptSource = jest.fn();
  const clock = jest.fn();
  expect(await receivePaymentProof({ repository, receiptSource, clock })(target)).toBe(previous);
  expect(receiptSource).not.toHaveBeenCalled();
  expect(clock).not.toHaveBeenCalled();
  expect(repository.receive).not.toHaveBeenCalled();
});
test('captura solicitud antes de await y conserva error de fuente sin filtrarlo', async () => {
  const input = { ...target };
  const repository = {
    findReceipt: jest.fn(async () => {
      input.cooperativeId = 'other';
      return null;
    }),
    receive: jest.fn().mockResolvedValue('ok'),
  };
  const receiptSource = jest.fn().mockResolvedValue(source());
  expect(await receivePaymentProof({ repository, receiptSource, clock: () => start })(input)).toBe(
    'ok',
  );
  expect(repository.receive.mock.calls[0][0]).toEqual(target);
  receiptSource.mockRejectedValue(new Error('SQL privado'));
  await expect(
    receivePaymentProof({ repository, receiptSource, clock: () => start })(target),
  ).rejects.toMatchObject({ code: 'BOOKING_LIFECYCLE_UNAVAILABLE' });
});
