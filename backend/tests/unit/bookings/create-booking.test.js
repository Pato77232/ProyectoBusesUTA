const createBooking = require('../../../src/modules/bookings/application/create-booking.use-case');
const getBookingSummary = require('../../../src/modules/bookings/application/get-booking-summary.use-case');
const { createPendingBooking } = require('../../../src/modules/bookings/domain/pending-booking');
const purchaseSetup = require('./helpers/booking-purchase-fixtures');

async function setup() {
  const fixture = purchaseSetup();
  const { dependencies, input, authContext } = fixture;
  const preview = await getBookingSummary(dependencies)(input, authContext);
  dependencies.tripCatalog.findBookableById.mockClear();
  dependencies.buyerIdentity.resolve.mockClear();
  const repository = {
    reserve: jest.fn(async (scope, prepare) => {
      const prepared = await prepare();
      return createPendingBooking(prepared.input, prepared.context);
    }),
  };
  Object.assign(dependencies, {
    repository,
    proofWindowSeconds: 300,
    newId: jest.fn(() => 'reserva-prueba'),
  });
  return {
    ...fixture,
    repository,
    execute: createBooking(dependencies),
    request: { ...input, summaryAccepted: true, acceptedSummaryRevision: preview.summaryRevision },
  };
}

test('crea reserva privada con dueño, configuración e identificador resueltos por servidor', async () => {
  const { execute, request, authContext, dependencies, repository } = await setup();
  const booking = await execute(request, authContext);
  expect(booking).toMatchObject({
    bookingId: 'reserva-prueba',
    ownerId: 'cliente-prueba',
    status: 'PENDING_PAYMENT',
    createdAt: '2026-10-27T15:00:00.000Z',
    expiresAt: '2026-10-27T15:05:00.000Z',
    summary: { totals: { totalPriceCents: 752 } },
  });
  expect(dependencies.buyerIdentity.resolve).toHaveBeenCalledWith(authContext);
  expect(repository.reserve).toHaveBeenCalledWith(
    { tripId: 'viaje-prueba', cooperativeId: 'cooperativa-prueba' },
    expect.any(Function),
  );
  expect(dependencies.tripCatalog.findBookableById).toHaveBeenCalledTimes(2);
  expect(dependencies.newId).toHaveBeenCalledTimes(1);
});

test.each(
  [
    {},
    { summaryAccepted: false },
    { summaryAccepted: 'true' },
    { acceptedSummaryRevision: undefined },
    { acceptedSummaryRevision: 'a'.repeat(63) },
    { acceptedSummaryRevision: 'A'.repeat(64) },
    { acceptedSummaryRevision: 'z'.repeat(64) },
    { ownerId: 'ajeno' },
    { cooperativeId: 'ajena' },
    { totalPriceCents: 1 },
    { proofWindowSeconds: 999 },
    { expiresAt: '2099-01-01' },
  ].map((entry) => [entry]),
)('rechaza solicitud inválida antes de proveedores: %j', async (change) => {
  const { execute, request, dependencies, repository } = await setup();
  const candidate = Object.keys(change).length ? { ...request, ...change } : undefined;
  await expect(execute(candidate)).rejects.toMatchObject({ code: 'BOOKING_VALIDATION_ERROR' });
  expect(dependencies.buyerIdentity.resolve).not.toHaveBeenCalled();
  expect(repository.reserve).not.toHaveBeenCalled();
});

test.each(['price', 'passenger', 'benefit', 'route', 'date'])(
  'cambio de %s exige nuevo resumen antes de generar ID',
  async (change) => {
    const { execute, request, dependencies } = await setup();
    const trip = await dependencies.tripCatalog.findBookableById();
    if (change === 'price') trip.segmentPricesCents[1] += 100;
    if (change === 'passenger') request.passengers[0].fullName = 'Otra Persona';
    if (change === 'benefit') {
      const entries = await dependencies.passengerVerifier.verify();
      entries[1].disabilityVerified = true;
    }
    if (change === 'route') request.toPosition = 4;
    if (change === 'date') trip.departureDate = '2026-10-29';
    await expect(execute(request)).rejects.toMatchObject({ code: 'BOOKING_SUMMARY_CHANGED' });
    expect(dependencies.newId).not.toHaveBeenCalled();
  },
);

test('relee catálogo y toma la hora después de esperar el bloqueo', async () => {
  const { execute, request, dependencies, repository } = await setup();
  repository.reserve.mockImplementation(async (scope, prepare) => {
    expect(dependencies.tripCatalog.findBookableById).toHaveBeenCalledTimes(1);
    dependencies.clock.mockReturnValue(new Date('2026-10-27T15:02:00Z'));
    const prepared = await prepare();
    return createPendingBooking(prepared.input, prepared.context);
  });
  const booking = await execute(request);
  expect(booking.createdAt).toBe('2026-10-27T15:02:00.000Z');
  expect(booking.expiresAt).toBe('2026-10-27T15:07:00.000Z');
});

test('cambio de precio durante espera del bloqueo no crea a precio viejo ni nuevo', async () => {
  const { execute, request, dependencies, repository } = await setup();
  const trip = await dependencies.tripCatalog.findBookableById();
  repository.reserve.mockImplementation(async (scope, prepare) => {
    trip.segmentPricesCents[1] = 999;
    return prepare();
  });
  await expect(execute(request)).rejects.toMatchObject({ code: 'BOOKING_SUMMARY_CHANGED' });
  expect(dependencies.newId).not.toHaveBeenCalled();
});

test('viaje que desaparece después de obtener el bloqueo no crea reserva', async () => {
  const { execute, request, dependencies, repository } = await setup();
  repository.reserve.mockImplementation(async (scope, prepare) => {
    dependencies.tripCatalog.findBookableById.mockResolvedValue(null);
    return prepare();
  });
  await expect(execute(request)).rejects.toMatchObject({ code: 'BOOKING_TRIP_UNAVAILABLE' });
});

test('cambio de cooperativa no escribe contra el bloqueo anterior', async () => {
  const { execute, request, dependencies } = await setup();
  const trip = await dependencies.tripCatalog.findBookableById();
  dependencies.tripCatalog.findBookableById
    .mockResolvedValueOnce(trip)
    .mockResolvedValueOnce({ ...trip, cooperativeId: 'otra-cooperativa' });
  await expect(execute(request)).rejects.toMatchObject({ code: 'BOOKING_SUMMARY_CHANGED' });
  expect(dependencies.newId).not.toHaveBeenCalled();
});

test('fallo de identidad impide iniciar transacción', async () => {
  const { execute, request, dependencies, repository } = await setup();
  const failure = new Error('comprador no autorizado');
  dependencies.buyerIdentity.resolve.mockRejectedValue(failure);
  await expect(execute(request)).rejects.toBe(failure);
  expect(repository.reserve).not.toHaveBeenCalled();
});

test('no oculta conflicto ni fallo transaccional con éxito aparente', async () => {
  const { execute, request, repository } = await setup();
  const failure = Object.assign(new Error('ocupado'), { code: 'BOOKING_SEAT_CONFLICT' });
  repository.reserve.mockRejectedValue(failure);
  await expect(execute(request)).rejects.toBe(failure);
});

test('conserva la copia aceptada aunque el solicitante mute sus objetos mientras se autoriza', async () => {
  const { execute, request, dependencies } = await setup();
  dependencies.buyerIdentity.resolve.mockImplementation(async () => {
    request.passengers[0].fullName = 'Persona cambiada';
    request.seatIds.push('99');
    request.acceptedSummaryRevision = '0'.repeat(64);
    return { ownerId: 'cliente-prueba' };
  });
  expect((await execute(request)).summary.passengers[1].fullName).toBe('Pasajera Menor');
});

test.each([undefined, 179, 301, '300'])(
  'rechaza configuración inválida %j al componer',
  async (seconds) => {
    const { dependencies } = await setup();
    expect(() => createBooking({ ...dependencies, proofWindowSeconds: seconds })).toThrow(
      expect.objectContaining({ code: 'BOOKING_VALIDATION_ERROR' }),
    );
  },
);

test('reloj se actualiza tras acreditación y no comparte Date mutable del proveedor', async () => {
  const { execute, request, dependencies } = await setup();
  const shared = new Date('2026-10-27T15:03:00Z');
  dependencies.clock.mockReturnValue(shared);
  dependencies.calendarDateAt.mockImplementation((instant) => {
    const day = instant.toISOString().slice(0, 10);
    instant.setUTCFullYear(2099);
    return day;
  });
  const booking = await execute(request);
  shared.setUTCFullYear(2099);
  expect(booking.createdAt).toBe('2026-10-27T15:03:00.000Z');
  expect(booking.expiresAt).toBe('2026-10-27T15:08:00.000Z');
});
