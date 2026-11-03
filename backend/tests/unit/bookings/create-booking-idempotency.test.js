const createBooking = require('../../../src/modules/bookings/application/create-booking.use-case');
const getBookingSummary = require('../../../src/modules/bookings/application/get-booking-summary.use-case');
const { createPendingBooking } = require('../../../src/modules/bookings/domain/pending-booking');
const {
  bookingCreationFingerprint,
} = require('../../../src/modules/bookings/domain/booking-creation-request');
const purchaseSetup = require('./helpers/booking-purchase-fixtures');

const key = '00000000-0000-4000-8000-000000000001';

async function setup() {
  const fixture = purchaseSetup();
  const { dependencies, input, authContext } = fixture;
  const preview = await getBookingSummary(dependencies)(input, authContext);
  dependencies.tripCatalog.findBookableById.mockClear();
  dependencies.buyerIdentity.resolve.mockClear();
  const repository = {
    reserve: jest.fn(),
    reserveOnce: jest.fn(async (operation, locate, prepare) => {
      const prepared = await prepare(await locate());
      return createPendingBooking(prepared.input, prepared.context);
    }),
  };
  Object.assign(dependencies, {
    repository,
    proofWindowSeconds: 300,
    newId: jest.fn(() => 'id-nuevo'),
  });
  return {
    ...fixture,
    repository,
    execute: createBooking(dependencies),
    request: {
      ...input,
      summaryAccepted: true,
      acceptedSummaryRevision: preview.summaryRevision,
      requestKey: key,
    },
  };
}

test('operación vincula clave y huella al dueño verificado fuera del body', async () => {
  const { execute, request, input, authContext, repository, dependencies } = await setup();
  const result = await execute(request, authContext);
  expect(repository.reserveOnce).toHaveBeenCalledWith(
    {
      ownerId: 'cliente-prueba',
      requestKey: key,
      requestFingerprint: bookingCreationFingerprint(input, request.acceptedSummaryRevision),
    },
    expect.any(Function),
    expect.any(Function),
  );
  expect(repository.reserve).not.toHaveBeenCalled();
  expect(dependencies.buyerIdentity.resolve).toHaveBeenCalledWith(authContext);
  expect(result.bookingId).toBe('id-nuevo');
  expect(result).not.toHaveProperty('requestKey');
});

test.each([undefined, null, '', 'no-uuid', key.toUpperCase().replace('4000', '4ABC')])(
  'clave presente inválida %j rechaza antes de identidad y transacción',
  async (requestKey) => {
    const { execute, request, dependencies, repository } = await setup();
    await expect(execute({ ...request, requestKey })).rejects.toMatchObject({
      code: 'BOOKING_VALIDATION_ERROR',
    });
    expect(dependencies.buyerIdentity.resolve).not.toHaveBeenCalled();
    expect(repository.reserveOnce).not.toHaveBeenCalled();
  },
);

test('reserva recuperada no consulta catálogo/acreditación/reloj ni vuelve a generar ID', async () => {
  const { execute, request, dependencies, repository } = await setup();
  const saved = { bookingId: 'id-guardado', expiresAt: '2026-10-27T15:05:00Z' };
  repository.reserveOnce.mockResolvedValue(saved);
  dependencies.tripCatalog.findBookableById.mockRejectedValue(new Error('catálogo caído'));
  dependencies.passengerVerifier.verify.mockClear();
  dependencies.clock.mockClear();
  expect(await execute(request)).toBe(saved);
  expect(dependencies.buyerIdentity.resolve).toHaveBeenCalledTimes(1);
  expect(dependencies.tripCatalog.findBookableById).not.toHaveBeenCalled();
  expect(dependencies.passengerVerifier.verify).not.toHaveBeenCalled();
  expect(dependencies.clock).not.toHaveBeenCalled();
  expect(dependencies.newId).not.toHaveBeenCalled();
});

test('identidad rechazada no busca una reserva por clave', async () => {
  const { execute, request, dependencies, repository } = await setup();
  const failure = new Error('sesión vencida');
  dependencies.buyerIdentity.resolve.mockRejectedValue(failure);
  await expect(execute(request)).rejects.toBe(failure);
  expect(repository.reserveOnce).not.toHaveBeenCalled();
});

test('mutación durante autenticación no cambia clave, huella ni solicitud preparada', async () => {
  const { execute, request, dependencies, repository } = await setup();
  dependencies.buyerIdentity.resolve.mockImplementation(async () => {
    request.requestKey = '00000000-0000-4000-8000-000000000099';
    request.passengers[0].fullName = 'Nombre cambiado';
    request.acceptedSummaryRevision = '0'.repeat(64);
    return { ownerId: 'cliente-prueba' };
  });
  const result = await execute(request);
  expect(result.summary.passengers[1].fullName).toBe('Pasajera Menor');
  expect(repository.reserveOnce.mock.calls[0][0].requestKey).toBe(key);
});

test('conflicto de reutilización de clave se propaga sin consultar viaje', async () => {
  const { execute, request, dependencies, repository } = await setup();
  const failure = Object.assign(new Error('clave usada'), { code: 'BOOKING_REQUEST_KEY_REUSED' });
  repository.reserveOnce.mockRejectedValue(failure);
  await expect(execute(request)).rejects.toBe(failure);
  expect(dependencies.tripCatalog.findBookableById).not.toHaveBeenCalled();
});
