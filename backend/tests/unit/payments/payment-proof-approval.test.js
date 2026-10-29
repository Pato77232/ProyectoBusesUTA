const {
  approvePaymentProof,
} = require('../../../src/modules/payments/domain/payment-proof-approval');
const {
  PaymentProofValidationError,
  PaymentProofNotPendingError,
} = require('../../../src/modules/payments/domain/payment-proof-error');

const uploadedProof = {
  id: 'proof-1',
  booking_id: 'booking-1',
  cooperative_id: 'coop-1',
  status: 'UPLOADED',
  approved_at: null,
  approved_by: null,
};

test('registra la identidad y fecha del oficinista en una aprobación', () => {
  const approvedAt = new Date('2026-10-29T18:00:00.000Z');

  const approved = approvePaymentProof(uploadedProof, 'clerk-1', approvedAt);

  expect(approved).toMatchObject({ approved_by: 'clerk-1', approved_at: approvedAt });
  expect(Object.isFrozen(approved)).toBe(true);
  expect(uploadedProof.approved_at).toBeNull();
});

test('repetir aprobación devuelve la misma decisión sin sustituir al primer oficinista', () => {
  const approved = approvePaymentProof(
    uploadedProof,
    'clerk-1',
    new Date('2026-10-29T18:00:00.000Z'),
  );

  expect(approvePaymentProof(approved, 'clerk-2', new Date('2026-10-29T18:01:00.000Z'))).toBe(
    approved,
  );
});

test('no aprueba comprobantes que no están cargados', () => {
  expect(() =>
    approvePaymentProof({ ...uploadedProof, status: 'EXPIRED' }, 'clerk-1', new Date()),
  ).toThrow(PaymentProofNotPendingError);
});

test.each([
  [null, new Date()],
  ['', new Date()],
  ['clerk-1', new Date('invalid')],
])('rechaza identidad o fecha inválidas', (approverId, approvedAt) => {
  expect(() => approvePaymentProof(uploadedProof, approverId, approvedAt)).toThrow(
    PaymentProofValidationError,
  );
});
