const ListAuthorizedPaymentProofs = require('../../../src/modules/payments/application/list-authorized-payment-proofs.use-case');

const context = { userId: 'clerk-A', role: 'CLERK', cooperativeId: 'tenant-A' };
const proof = { id: 'proof-A', booking_id: 'booking-A', cooperative_id: 'tenant-A' };
const booking = { bookingId: 'booking-A', cooperativeId: 'tenant-A', total: 0, currency: 'USD' };
function setup() {
  const repository = {
    listPendingByCooperative: jest.fn().mockResolvedValue({ items: [proof], nextCursor: 'next' }),
  };
  const reader = { findForPayment: jest.fn().mockResolvedValue(booking) };
  return {
    repository,
    reader,
    useCase: new ListAuthorizedPaymentProofs({
      paymentProofRepository: repository,
      bookingReader: reader,
    }),
  };
}

test.each([undefined, null, {}, [], { role: 'CLERK', cooperativeId: 'tenant-A' }])(
  'deniega identidad ausente antes de consultar',
  async (authContext) => {
    const { useCase, repository, reader } = setup();
    await expect(useCase.execute({ authContext })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      httpStatus: 401,
    });
    expect(repository.listPendingByCooperative).not.toHaveBeenCalled();
    expect(reader.findForPayment).not.toHaveBeenCalled();
  },
);

test.each([
  { ...context, role: 'CUSTOMER' },
  { ...context, role: 'COOPERATIVE_ADMIN' },
  { ...context, cooperativeId: null },
])('deniega rol o tenant inválidos antes del repositorio', async (authContext) => {
  const { useCase, repository } = setup();
  await expect(useCase.execute({ authContext })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(repository.listPendingByCooperative).not.toHaveBeenCalled();
});

test('proyecta contexto, fija propósito y conserva cero/cursor sin mutar argumentos', async () => {
  const { useCase, repository, reader } = setup();
  const authContext = { ...context, email: 'no-debe-pasarse@qa.invalid' };
  const page = await useCase.execute({
    authContext,
    cooperativeId: 'tenant-ajeno',
    cursor: 'opaque',
  });
  expect(repository.listPendingByCooperative).toHaveBeenCalledWith({
    cooperativeId: 'tenant-A',
    limit: 50,
    cursor: 'opaque',
  });
  expect(reader.findForPayment).toHaveBeenCalledWith(
    { bookingId: 'booking-A', purpose: 'REVIEW_PAYMENT' },
    context,
  );
  expect(page.items[0].total_cents).toBe(0);
  expect(page.nextCursor).toBe('next');
  expect(Object.isFrozen(page.items)).toBe(true);
  expect(authContext.email).toBeDefined();
});

test('copia el contexto antes del primer await', async () => {
  const { useCase, repository, reader } = setup();
  let finish;
  repository.listPendingByCooperative.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const authContext = { ...context };
  const result = useCase.execute({ authContext });
  authContext.cooperativeId = 'tenant-B';
  authContext.userId = 'clerk-B';
  finish({ items: [proof], nextCursor: null });
  await result;
  expect(reader.findForPayment.mock.calls[0][1]).toEqual(context);
  expect(Object.isFrozen(reader.findForPayment.mock.calls[0][1])).toBe(true);
});

test.each([
  null,
  { ...booking, cooperativeId: 'otro' },
  { ...booking, bookingId: 'otra' },
  { ...booking, total: undefined },
  { ...booking, currency: 'EUR' },
])('una relación ausente/incoherente falla sin devolver lista parcial', async (value) => {
  const { useCase, reader } = setup();
  reader.findForPayment.mockResolvedValue(value);
  await expect(useCase.execute({ authContext: context })).rejects.toMatchObject({
    code: 'BOOKING_DATA_INTEGRITY_ERROR',
    httpStatus: 500,
  });
});

test('fila de otra cooperativa no provoca consulta al lector', async () => {
  const { useCase, repository, reader } = setup();
  repository.listPendingByCooperative.mockResolvedValue({
    items: [{ ...proof, cooperative_id: 'otro' }],
    nextCursor: null,
  });
  await expect(useCase.execute({ authContext: context })).rejects.toMatchObject({
    code: 'BOOKING_DATA_INTEGRITY_ERROR',
  });
  expect(reader.findForPayment).not.toHaveBeenCalled();
});

test('cursor inválido se rechaza antes del repositorio', async () => {
  const { useCase, repository } = setup();
  await expect(useCase.execute({ authContext: context, cursor: {} })).rejects.toMatchObject({
    code: 'PAYMENT_PROOF_VALIDATION_ERROR',
  });
  expect(repository.listPendingByCooperative).not.toHaveBeenCalled();
});

test('preserva el error clasificado del adaptador sin reintentar', async () => {
  const { useCase, reader } = setup();
  const error = Object.assign(new Error('mensaje seguro'), {
    code: 'BOOKING_QUERY_UNAVAILABLE',
    httpStatus: 503,
  });
  reader.findForPayment.mockRejectedValue(error);
  await expect(useCase.execute({ authContext: context })).rejects.toBe(error);
  expect(reader.findForPayment).toHaveBeenCalledTimes(1);
});
