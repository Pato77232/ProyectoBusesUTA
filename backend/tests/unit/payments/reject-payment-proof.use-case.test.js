const RejectPaymentProof = require('../../../src/modules/payments/application/reject-payment-proof.use-case');

const proof = {
  id: 'proof-1',
  booking_id: 'booking-1',
  cooperative_id: 'coop-1',
  status: 'UPLOADED',
  approved_at: null,
};

test('exige justificación y propaga el rechazo persistido', async () => {
  const paymentProofRepository = {
    findByIdAndCooperativeId: jest.fn(async () => proof),
    markRejectedIfPending: jest.fn(async (input) => ({ ...proof, ...input, status: 'REJECTED' })),
  };
  const bookingSaleConfirmer = { rejectSale: jest.fn(async () => true) };
  const useCase = new RejectPaymentProof({ paymentProofRepository, bookingSaleConfirmer });
  const result = await useCase.execute({
    paymentProofId: 'proof-1',
    cooperativeId: 'coop-1',
    rejectedBy: 'clerk-1',
    justification: 'Archivo ilegible.',
    now: new Date('2026-11-04T15:00:00.000Z'),
  });
  expect(result.status).toBe('REJECTED');
  expect(bookingSaleConfirmer.rejectSale).toHaveBeenCalledWith(
    expect.objectContaining({
      bookingId: 'booking-1',
      paymentProofId: 'proof-1',
      rejectedBy: 'clerk-1',
      justification: 'Archivo ilegible.',
    }),
  );
});

test('rechaza entrada sin motivo antes de consultar datos', async () => {
  const paymentProofRepository = { findByIdAndCooperativeId: jest.fn() };
  const useCase = new RejectPaymentProof({
    paymentProofRepository,
    bookingSaleConfirmer: { rejectSale: jest.fn() },
  });
  await expect(
    useCase.execute({
      paymentProofId: 'proof-1',
      cooperativeId: 'coop-1',
      rejectedBy: 'clerk-1',
      justification: ' ',
      now: new Date(),
    }),
  ).rejects.toMatchObject({ code: 'PAYMENT_PROOF_VALIDATION_ERROR' });
  expect(paymentProofRepository.findByIdAndCooperativeId).not.toHaveBeenCalled();
});
