const confirmSale = require('../../../src/modules/bookings/application/confirm-sale.use-case');
const BookingSaleError = require('../../../src/modules/bookings/domain/booking-sale-error');
const BookingLifecycleError = require('../../../src/modules/bookings/domain/booking-lifecycle-error');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');
const target = Object.freeze({
  bookingId: 'reserva-opaca',
  cooperativeId: 'coop-qa',
  paymentProofId: 'proof-qa',
});
const intent = Object.freeze({
  ...target,
  proofVersion: 1,
  requestedBy: 'clerk-qa',
  requestedAt: '2026-11-04T14:01:00.000Z',
});
const result = Object.freeze({
  ...intent,
  currency: 'USD',
  totalPriceCents: 752,
  confirmedAt: '2026-11-04T14:02:00.000Z',
});
function harness(source = intent) {
  const approvalSource = jest.fn().mockResolvedValue(source);
  const repository = { confirmSale: jest.fn().mockResolvedValue(result) };
  const clock = jest.fn();
  return {
    approvalSource,
    repository,
    clock,
    sell: confirmSale({ repository, approvalSource, clock }),
  };
}

test('consulta la fuente con tres IDs y solo devuelve el resultado persistido validado', async () => {
  const { sell, approvalSource, repository, clock } = harness();
  expect(await sell(target)).toEqual(result);
  expect(approvalSource).toHaveBeenCalledWith(target);
  expect(repository.confirmSale).toHaveBeenCalledWith(intent, clock);
  expect(approvalSource.mock.invocationCallOrder[0]).toBeLessThan(
    repository.confirmSale.mock.invocationCallOrder[0],
  );
  expect(clock).not.toHaveBeenCalled();
  expect(Object.isFrozen(approvalSource.mock.calls[0][0])).toBe(true);
  expect(Object.isFrozen(repository.confirmSale.mock.calls[0][0])).toBe(true);
});

test('copia el alcance antes de esperar y no acepta mutaciones del llamador', async () => {
  let release;
  const repository = { confirmSale: jest.fn().mockResolvedValue(result) };
  const approvalSource = jest.fn(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const sell = confirmSale({ repository, approvalSource, clock: jest.fn() });
  const input = { ...target };
  const pending = sell(input);
  input.bookingId = 'otra';
  release({ ...intent });
  expect(await pending).toEqual(result);
  expect(repository.confirmSale.mock.calls[0][0].bookingId).toBe(target.bookingId);
});

test.each([
  null,
  undefined,
  {},
  [],
  { ...target, proofVersion: 1 },
  { ...target, totalPriceCents: 1 },
  { ...target, role: 'CLERK' },
  { ...target, ownerId: 'otro' },
])('entrada inválida no consulta fuente ni repositorio %j', async (input) => {
  const h = harness();
  await expect(h.sell(input)).rejects.toBeInstanceOf(BookingValidationError);
  expect(h.approvalSource).not.toHaveBeenCalled();
  expect(h.repository.confirmSale).not.toHaveBeenCalled();
});

test('ausencia de intención es incierta y no intenta vender', async () => {
  const h = harness(null);
  await expect(h.sell(target)).rejects.toMatchObject({ code: 'BOOKING_SALE_UNAVAILABLE' });
  expect(h.repository.confirmSale).not.toHaveBeenCalled();
});

test('fallo de fuente no filtra SQL ni invoca persistencia', async () => {
  const h = harness();
  h.approvalSource.mockRejectedValue(new Error('SELECT secreto FROM ruta/privada'));
  await expect(h.sell(target)).rejects.toMatchObject({ code: 'BOOKING_SALE_UNAVAILABLE' });
  try {
    await h.sell(target);
  } catch (error) {
    expect(error.message).not.toMatch(/SELECT|secreto|privada/);
  }
  expect(h.repository.confirmSale).not.toHaveBeenCalled();
});

test.each([
  undefined,
  {},
  true,
  { ...intent, proofVersion: null },
  { ...intent, proofVersion: 0 },
  { ...intent, requestedBy: null },
])('fuente incompleta o histórica no inventa autorización/versión %j', async (source) => {
  const h = harness();
  h.approvalSource.mockResolvedValue(source);
  await expect(h.sell(target)).rejects.toMatchObject({ code: 'BOOKING_SALE_DATA_INTEGRITY_ERROR' });
  expect(h.repository.confirmSale).not.toHaveBeenCalled();
});

test.each(['bookingId', 'cooperativeId', 'paymentProofId'])(
  'rechaza fuente con vínculo incorrecto %s',
  async (key) => {
    const h = harness({ ...intent, [key]: 'otro' });
    await expect(h.sell(target)).rejects.toMatchObject({ code: 'BOOKING_SALE_LINK_MISMATCH' });
    expect(h.repository.confirmSale).not.toHaveBeenCalled();
  },
);

test.each([true, false, undefined, {}, { ...result, totalPriceCents: -1 }])(
  'resultado no confirmado no se convierte en éxito %j',
  async (stored) => {
    const h = harness();
    h.repository.confirmSale.mockResolvedValue(stored);
    await expect(h.sell(target)).rejects.toMatchObject({
      code: 'BOOKING_SALE_DATA_INTEGRITY_ERROR',
    });
  },
);

test('resultado ausente del repositorio permanece incierto', async () => {
  const h = harness();
  h.repository.confirmSale.mockResolvedValue(null);
  await expect(h.sell(target)).rejects.toMatchObject({ code: 'BOOKING_SALE_UNAVAILABLE' });
});

test.each([
  'BOOKING_SALE_NOT_CONFIRMABLE',
  'BOOKING_SALE_LINK_MISMATCH',
  'BOOKING_SALE_VERSION_MISMATCH',
  'BOOKING_SALE_DATA_INTEGRITY_ERROR',
])('conserva error de dominio %s', async (code) => {
  const h = harness();
  h.repository.confirmSale.mockRejectedValue(new BookingSaleError(code));
  await expect(h.sell(target)).rejects.toMatchObject({ code });
});

test.each([
  [new BookingLifecycleError('BOOKING_NOT_FOUND'), 'BOOKING_SALE_NOT_CONFIRMABLE'],
  [new BookingLifecycleError('BOOKING_DATA_INTEGRITY_ERROR'), 'BOOKING_SALE_DATA_INTEGRITY_ERROR'],
  [new BookingLifecycleError(), 'BOOKING_SALE_UNAVAILABLE'],
  [new Error('SQL servidor privado'), 'BOOKING_SALE_UNAVAILABLE'],
])('clasifica fallo persistido sin exponer infraestructura', async (error, code) => {
  const h = harness();
  h.repository.confirmSale.mockRejectedValue(error);
  await expect(h.sell(target)).rejects.toMatchObject({ code });
});

test('reintento con fuente caída no recupera por IDs sin volver a comprobar intención', async () => {
  const h = harness();
  expect(await h.sell(target)).toEqual(result);
  h.approvalSource.mockRejectedValueOnce(new Error('timeout'));
  await expect(h.sell(target)).rejects.toMatchObject({ code: 'BOOKING_SALE_UNAVAILABLE' });
  expect(h.repository.confirmSale).toHaveBeenCalledTimes(1);
  expect(await h.sell(target)).toEqual(result);
  expect(h.repository.confirmSale).toHaveBeenCalledTimes(2);
});

test.each([undefined, null, {}, { confirmSale: () => true }])(
  'constructor exige función fuente explícita %j',
  (approvalSource) => {
    expect(() =>
      confirmSale({ repository: { confirmSale: jest.fn() }, approvalSource, clock: jest.fn() }),
    ).toThrow(TypeError);
  },
);
