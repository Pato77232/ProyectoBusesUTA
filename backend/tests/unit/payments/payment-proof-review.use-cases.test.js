const ListPendingPaymentProofs = require('../../../src/modules/payments/application/list-pending-payment-proofs.use-case');
const ReadPaymentProofFile = require('../../../src/modules/payments/application/read-payment-proof-file.use-case');
const ApprovePaymentProof = require('../../../src/modules/payments/application/approve-payment-proof.use-case');
const {
  BookingSaleRejectedError,
  BookingSaleUncertainError,
  PaymentProofApprovalPersistenceUncertainError,
  PaymentProofNotFoundError,
  PaymentProofNotPendingError,
  PaymentProofTotalUnavailableError,
  PaymentProofValidationError,
} = require('../../../src/modules/payments/domain/payment-proof-error');

const pendingProof = Object.freeze({
  id: 'a80a2c4d-8aa8-4a1f-b7b0-e8d0f002bc42',
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
  approval_requested_at: null,
  approval_requested_by: null,
});

const PAYMENT_PROOF_ID = 'a80a2c4d-8aa8-4a1f-b7b0-e8d0f002bc42';

function createRepository(overrides = {}) {
  return {
    listPendingByCooperative: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    findByIdAndCooperativeId: jest.fn().mockResolvedValue(pendingProof),
    markApprovalRequestedIfPending: jest
      .fn()
      .mockImplementation(async ({ requestedBy, requestedAt }) => ({
        ...pendingProof,
        approval_requested_by: requestedBy,
        approval_requested_at: requestedAt,
      })),
    markApprovedIfPending: jest.fn().mockImplementation(async ({ approvedBy, approvedAt }) => ({
      ...pendingProof,
      approved_by: approvedBy,
      approved_at: approvedAt,
      approval_requested_by: approvedBy,
      approval_requested_at: approvedAt,
    })),
    ...overrides,
  };
}

test('lista pendientes con la cooperativa verificada y paginación acotada', async () => {
  const paymentProofRepository = createRepository();
  const bookingReader = {
    findForPayment: jest.fn().mockResolvedValue({ cooperativeId: 'coop-1', total: 2550 }),
  };
  paymentProofRepository.listPendingByCooperative.mockResolvedValue({
    items: [pendingProof],
    nextCursor: 'next',
  });
  const useCase = new ListPendingPaymentProofs({ paymentProofRepository, bookingReader });

  await expect(
    useCase.execute({ cooperativeId: 'coop-1', cursor: 'opaque' }),
  ).resolves.toMatchObject({
    items: [{ id: PAYMENT_PROOF_ID, total_cents: 2550 }],
    nextCursor: 'next',
  });
  expect(paymentProofRepository.listPendingByCooperative).toHaveBeenCalledWith({
    cooperativeId: 'coop-1',
    limit: 50,
    cursor: 'opaque',
  });
  expect(bookingReader.findForPayment).toHaveBeenCalledWith(pendingProof.booking_id);
});

test('rechaza el listado si no recibe la cooperativa autenticada', async () => {
  const useCase = new ListPendingPaymentProofs({
    paymentProofRepository: createRepository(),
    bookingReader: { findForPayment: jest.fn() },
  });

  await expect(useCase.execute({ cooperativeId: '' })).rejects.toBeInstanceOf(
    PaymentProofValidationError,
  );
});

test('no muestra comprobantes si no puede verificar cooperativa y total de reserva', async () => {
  const paymentProofRepository = createRepository({
    listPendingByCooperative: jest
      .fn()
      .mockResolvedValue({ items: [pendingProof], nextCursor: null }),
  });
  const useCase = new ListPendingPaymentProofs({
    paymentProofRepository,
    bookingReader: {
      findForPayment: jest.fn().mockResolvedValue({ cooperativeId: 'coop-2', total: 2550 }),
    },
  });

  await expect(useCase.execute({ cooperativeId: 'coop-1' })).rejects.toBeInstanceOf(
    PaymentProofTotalUnavailableError,
  );
});

test('responde temporalmente si bookings no entrega el total autoritativo', async () => {
  const paymentProofRepository = createRepository({
    listPendingByCooperative: jest
      .fn()
      .mockResolvedValue({ items: [pendingProof], nextCursor: null }),
  });
  const useCase = new ListPendingPaymentProofs({
    paymentProofRepository,
    bookingReader: { findForPayment: jest.fn().mockRejectedValue(new Error('timeout')) },
  });

  await expect(useCase.execute({ cooperativeId: 'coop-1' })).rejects.toMatchObject({
    code: 'PAYMENT_PROOF_TOTAL_UNAVAILABLE',
    httpStatus: 503,
  });
});

test('lee el archivo solo después de consultar el comprobante dentro de la cooperativa', async () => {
  const content = Buffer.from('%PDF-1.7');
  const paymentProofRepository = createRepository();
  const fileReader = { read: jest.fn().mockResolvedValue(content) };
  const useCase = new ReadPaymentProofFile({ paymentProofRepository, fileReader });

  await expect(
    useCase.execute({ paymentProofId: PAYMENT_PROOF_ID, cooperativeId: 'coop-1' }),
  ).resolves.toEqual({
    content,
    mediaType: 'application/pdf',
    originalFileName: 'transferencia.pdf',
  });
  expect(paymentProofRepository.findByIdAndCooperativeId).toHaveBeenCalledWith(
    PAYMENT_PROOF_ID,
    'coop-1',
  );
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
    missing.execute({ paymentProofId: PAYMENT_PROOF_ID, cooperativeId: 'coop-2' }),
  ).rejects.toBeInstanceOf(PaymentProofNotFoundError);
  await expect(
    approved.execute({ paymentProofId: PAYMENT_PROOF_ID, cooperativeId: 'coop-1' }),
  ).rejects.toBeInstanceOf(PaymentProofNotPendingError);
  expect(fileReader.read).not.toHaveBeenCalled();
});

test('rechaza identificadores que no sean UUID antes de consultar el repositorio', async () => {
  const paymentProofRepository = createRepository();
  const fileReader = { read: jest.fn() };
  const readFile = new ReadPaymentProofFile({ paymentProofRepository, fileReader });
  const approve = new ApprovePaymentProof({
    paymentProofRepository,
    bookingSaleConfirmer: { confirmSale: jest.fn() },
  });

  await expect(
    readFile.execute({ paymentProofId: 'not-a-uuid', cooperativeId: 'coop-1' }),
  ).rejects.toBeInstanceOf(PaymentProofValidationError);
  await expect(
    approve.execute({
      paymentProofId: 'not-a-uuid',
      cooperativeId: 'coop-1',
      approverId: 'clerk-1',
      now: new Date(),
    }),
  ).rejects.toBeInstanceOf(PaymentProofValidationError);
  expect(paymentProofRepository.findByIdAndCooperativeId).not.toHaveBeenCalled();
  expect(fileReader.read).not.toHaveBeenCalled();
});

test('confirma la venta por el puerto y persiste la identidad del oficinista', async () => {
  const paymentProofRepository = createRepository();
  const bookingSaleConfirmer = { confirmSale: jest.fn().mockResolvedValue(true) };
  const useCase = new ApprovePaymentProof({ paymentProofRepository, bookingSaleConfirmer });
  const now = new Date('2026-10-29T18:00:00.000Z');

  await expect(
    useCase.execute({
      paymentProofId: PAYMENT_PROOF_ID,
      cooperativeId: 'coop-1',
      approverId: 'clerk-1',
      now,
    }),
  ).resolves.toMatchObject({ approved_by: 'clerk-1', approved_at: now });
  expect(bookingSaleConfirmer.confirmSale).toHaveBeenCalledWith({
    bookingId: 'booking-1',
    cooperativeId: 'coop-1',
    paymentProofId: PAYMENT_PROOF_ID,
  });
  expect(paymentProofRepository.markApprovedIfPending).toHaveBeenCalledWith({
    paymentProofId: PAYMENT_PROOF_ID,
    cooperativeId: 'coop-1',
    approvedBy: 'clerk-1',
    approvedAt: now,
  });
  expect(paymentProofRepository.markApprovalRequestedIfPending).toHaveBeenCalledWith({
    paymentProofId: PAYMENT_PROOF_ID,
    cooperativeId: 'coop-1',
    requestedBy: 'clerk-1',
    requestedAt: now,
  });
  expect(
    paymentProofRepository.markApprovalRequestedIfPending.mock.invocationCallOrder[0],
  ).toBeLessThan(bookingSaleConfirmer.confirmSale.mock.invocationCallOrder[0]);
});

test('recupera la intención pendiente con el mismo comprobante y conserva al oficinista original', async () => {
  const requestedAt = new Date('2026-10-29T17:30:00.000Z');
  const approvalIntent = {
    ...pendingProof,
    approval_requested_at: requestedAt,
    approval_requested_by: 'clerk-original',
  };
  const paymentProofRepository = createRepository({
    markApprovalRequestedIfPending: jest.fn().mockResolvedValue(approvalIntent),
  });
  const bookingSaleConfirmer = { confirmSale: jest.fn().mockResolvedValue(true) };
  const useCase = new ApprovePaymentProof({ paymentProofRepository, bookingSaleConfirmer });

  await useCase.execute({
    paymentProofId: PAYMENT_PROOF_ID,
    cooperativeId: 'coop-1',
    approverId: 'clerk-retry',
    now: new Date('2026-10-29T18:00:00.000Z'),
  });

  expect(bookingSaleConfirmer.confirmSale).toHaveBeenCalledWith({
    bookingId: pendingProof.booking_id,
    cooperativeId: pendingProof.cooperative_id,
    paymentProofId: PAYMENT_PROOF_ID,
  });
  expect(paymentProofRepository.markApprovedIfPending).toHaveBeenCalledWith(
    expect.objectContaining({ approvedBy: 'clerk-original' }),
  );
});

test('no invoca bookings si no pudo persistir la intención de aprobación', async () => {
  const bookingSaleConfirmer = { confirmSale: jest.fn() };
  const useCase = new ApprovePaymentProof({
    paymentProofRepository: createRepository({
      markApprovalRequestedIfPending: jest
        .fn()
        .mockRejectedValue(new Error('database unavailable')),
    }),
    bookingSaleConfirmer,
  });

  await expect(
    useCase.execute({
      paymentProofId: PAYMENT_PROOF_ID,
      cooperativeId: 'coop-1',
      approverId: 'clerk-1',
      now: new Date(),
    }),
  ).rejects.toMatchObject({ code: 'PAYMENT_PROOF_APPROVAL_INTENT_PERSISTENCE_FAILED' });
  expect(bookingSaleConfirmer.confirmSale).not.toHaveBeenCalled();
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
      paymentProofId: PAYMENT_PROOF_ID,
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
    paymentProofId: PAYMENT_PROOF_ID,
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
      paymentProofId: PAYMENT_PROOF_ID,
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
      paymentProofId: PAYMENT_PROOF_ID,
      cooperativeId: 'coop-1',
      approverId: 'clerk-1',
      now: new Date(),
    }),
  ).rejects.toBeInstanceOf(PaymentProofApprovalPersistenceUncertainError);
});
