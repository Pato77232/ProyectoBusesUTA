const ListPendingPaymentProofs = require('../../../src/modules/payments/application/list-pending-payment-proofs.use-case');
const ReadPaymentProofFile = require('../../../src/modules/payments/application/read-payment-proof-file.use-case');
const ApprovePaymentProof = require('../../../src/modules/payments/application/approve-payment-proof.use-case');
const {
  BookingSaleRejectedError,
  BookingSaleUncertainError,
  PaymentProofApprovalPersistenceUncertainError,
  PaymentProofNotFoundError,
  PaymentProofNotPendingError,
  PaymentProofValidationError,
} = require('../../../src/modules/payments/domain/payment-proof-error');

const pendingProof = Object.freeze({
  id: 'proof-1',
  booking_id: 'booking-1',
  cooperative_id: 'coop-1',
  status: 'UPLOADED',
  file_key: 'private-key',
  original_file_name: 'transferencia.pdf',
  media_type: 'application/pdf',
  file_size_bytes: 64,
  uploaded_at: new Date('2026-10-29T17:00:00.000Z'),
  approved_at: null,
  approved_by: null,
});

function createRepository(overrides = {}) {
  return {
    listPendingByCooperative: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    findByIdAndCooperativeId: jest.fn().mockResolvedValue(pendingProof),
    markApprovedIfPending: jest.fn().mockImplementation(async ({ approvedBy, approvedAt }) => ({
      ...pendingProof,
      approved_by: approvedBy,
      approved_at: approvedAt,
    })),
    ...overrides,
  };
}

test('lista pendientes con la cooperativa verificada y paginación acotada', async () => {
  const paymentProofRepository = createRepository();
  const useCase = new ListPendingPaymentProofs({ paymentProofRepository });

  await expect(useCase.execute({ cooperativeId: 'coop-1', cursor: 'opaque' })).resolves.toEqual({
    items: [],
    nextCursor: null,
  });
  expect(paymentProofRepository.listPendingByCooperative).toHaveBeenCalledWith({
    cooperativeId: 'coop-1',
    limit: 50,
    cursor: 'opaque',
  });
});

test('rechaza el listado si no recibe la cooperativa autenticada', async () => {
  const useCase = new ListPendingPaymentProofs({ paymentProofRepository: createRepository() });

  await expect(useCase.execute({ cooperativeId: '' })).rejects.toBeInstanceOf(
    PaymentProofValidationError,
  );
});

test('lee el archivo solo después de consultar el comprobante dentro de la cooperativa', async () => {
  const content = Buffer.from('%PDF-1.7');
  const paymentProofRepository = createRepository();
  const fileReader = { read: jest.fn().mockResolvedValue(content) };
  const useCase = new ReadPaymentProofFile({ paymentProofRepository, fileReader });

  await expect(
    useCase.execute({ paymentProofId: 'proof-1', cooperativeId: 'coop-1' }),
  ).resolves.toEqual({
    content,
    mediaType: 'application/pdf',
    originalFileName: 'transferencia.pdf',
  });
  expect(paymentProofRepository.findByIdAndCooperativeId).toHaveBeenCalledWith('proof-1', 'coop-1');
  expect(fileReader.read).toHaveBeenCalledWith('private-key');
});

test('no lee archivos inexistentes, ajenos ni aprobados', async () => {
  const fileReader = { read: jest.fn() };
  const missing = new ReadPaymentProofFile({
    paymentProofRepository: createRepository({
      findByIdAndCooperativeId: jest.fn().mockResolvedValue(null),
    }),
    fileReader,
  });
  const approved = new ReadPaymentProofFile({
    paymentProofRepository: createRepository({
      findByIdAndCooperativeId: jest
        .fn()
        .mockResolvedValue({ ...pendingProof, approved_at: new Date() }),
    }),
    fileReader,
  });

  await expect(
    missing.execute({ paymentProofId: 'proof-1', cooperativeId: 'coop-2' }),
  ).rejects.toBeInstanceOf(PaymentProofNotFoundError);
  await expect(
    approved.execute({ paymentProofId: 'proof-1', cooperativeId: 'coop-1' }),
  ).rejects.toBeInstanceOf(PaymentProofNotPendingError);
  expect(fileReader.read).not.toHaveBeenCalled();
});

test('confirma la venta por el puerto y persiste la identidad del oficinista', async () => {
  const paymentProofRepository = createRepository();
  const bookingSaleConfirmer = { confirmSale: jest.fn().mockResolvedValue(true) };
  const useCase = new ApprovePaymentProof({ paymentProofRepository, bookingSaleConfirmer });
  const now = new Date('2026-10-29T18:00:00.000Z');

  await expect(
    useCase.execute({
      paymentProofId: 'proof-1',
      cooperativeId: 'coop-1',
      approverId: 'clerk-1',
      now,
    }),
  ).resolves.toMatchObject({ approved_by: 'clerk-1', approved_at: now });
  expect(bookingSaleConfirmer.confirmSale).toHaveBeenCalledWith({
    bookingId: 'booking-1',
    cooperativeId: 'coop-1',
    paymentProofId: 'proof-1',
  });
  expect(paymentProofRepository.markApprovedIfPending).toHaveBeenCalledWith({
    paymentProofId: 'proof-1',
    cooperativeId: 'coop-1',
    approvedBy: 'clerk-1',
    approvedAt: now,
  });
});

test('un comprobante ya aprobado devuelve su decisión sin confirmar otra venta', async () => {
  const approvedProof = { ...pendingProof, approved_at: new Date(), approved_by: 'clerk-1' };
  const bookingSaleConfirmer = { confirmSale: jest.fn() };
  const useCase = new ApprovePaymentProof({
    paymentProofRepository: createRepository({
      findByIdAndCooperativeId: jest.fn().mockResolvedValue(approvedProof),
    }),
    bookingSaleConfirmer,
  });

  await expect(
    useCase.execute({
      paymentProofId: 'proof-1',
      cooperativeId: 'coop-1',
      approverId: 'clerk-2',
      now: new Date(),
    }),
  ).resolves.toBe(approvedProof);
  expect(bookingSaleConfirmer.confirmSale).not.toHaveBeenCalled();
});

test('mantiene pendiente el comprobante si confirmSale rechaza o queda incierto', async () => {
  const paymentProofRepository = createRepository();
  const useCase = new ApprovePaymentProof({
    paymentProofRepository,
    bookingSaleConfirmer: {
      confirmSale: jest.fn().mockRejectedValue(new BookingSaleRejectedError()),
    },
  });
  const input = {
    paymentProofId: 'proof-1',
    cooperativeId: 'coop-1',
    approverId: 'clerk-1',
    now: new Date(),
  };

  await expect(useCase.execute(input)).rejects.toBeInstanceOf(BookingSaleRejectedError);
  expect(paymentProofRepository.markApprovedIfPending).not.toHaveBeenCalled();

  const uncertain = new ApprovePaymentProof({
    paymentProofRepository,
    bookingSaleConfirmer: { confirmSale: jest.fn().mockRejectedValue(new Error('timeout')) },
  });
  await expect(uncertain.execute(input)).rejects.toBeInstanceOf(BookingSaleUncertainError);
});

test('devuelve el resultado aprobado cuando otra solicitud gana la actualización condicional', async () => {
  const approvedProof = { ...pendingProof, approved_at: new Date(), approved_by: 'clerk-2' };
  const paymentProofRepository = createRepository({
    markApprovedIfPending: jest.fn().mockResolvedValue(null),
    findByIdAndCooperativeId: jest
      .fn()
      .mockResolvedValueOnce(pendingProof)
      .mockResolvedValueOnce(approvedProof),
  });
  const useCase = new ApprovePaymentProof({
    paymentProofRepository,
    bookingSaleConfirmer: { confirmSale: jest.fn().mockResolvedValue(true) },
  });

  await expect(
    useCase.execute({
      paymentProofId: 'proof-1',
      cooperativeId: 'coop-1',
      approverId: 'clerk-1',
      now: new Date(),
    }),
  ).resolves.toBe(approvedProof);
});

test('indica incertidumbre si no puede persistir una venta confirmada', async () => {
  const useCase = new ApprovePaymentProof({
    paymentProofRepository: createRepository({
      markApprovedIfPending: jest.fn().mockRejectedValue(new Error('database unavailable')),
    }),
    bookingSaleConfirmer: { confirmSale: jest.fn().mockResolvedValue(true) },
  });

  await expect(
    useCase.execute({
      paymentProofId: 'proof-1',
      cooperativeId: 'coop-1',
      approverId: 'clerk-1',
      now: new Date(),
    }),
  ).rejects.toBeInstanceOf(PaymentProofApprovalPersistenceUncertainError);
});
