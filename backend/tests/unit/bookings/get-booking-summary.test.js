const getBookingSummary = require('../../../src/modules/bookings/application/get-booking-summary.use-case');
const purchaseSetup = require('./helpers/booking-purchase-fixtures');

function setup() {
  const fixture = purchaseSetup();
  return { ...fixture, execute: getBookingSummary(fixture.dependencies) };
}

test('entrega resumen privado y revisión sin guardar, generar ID ni iniciar plazo', async () => {
  const { execute, input, authContext, dependencies } = setup();
  const result = await execute(input, authContext);
  expect(result.summary.totals.totalPriceCents).toBe(752);
  expect(result.summaryRevision).toMatch(/^[a-f0-9]{64}$/);
  expect(result.summary).not.toHaveProperty('expiresAt');
  expect(result.summary).not.toHaveProperty('bookingId');
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.summary.passengers[0])).toBe(true);
  expect(dependencies.buyerIdentity.resolve).toHaveBeenCalledWith(authContext);
  expect(dependencies.passengerVerifier.verify).toHaveBeenCalledWith({
    ownerId: 'cliente-prueba',
    passengers: result.summary.passengers.map(({ quote, ...rest }) => rest),
    departureDate: '2026-10-28',
  });
});

test.each(['ownerId', 'cooperativeId', 'totalPriceCents', 'disabilityVerified', 'summaryAccepted'])(
  'rechaza inyección de %s antes de consultar identidad o catálogo',
  async (field) => {
    const { execute, input, dependencies } = setup();
    await expect(execute({ ...input, [field]: 'inyectado' })).rejects.toMatchObject({
      code: 'BOOKING_VALIDATION_ERROR',
    });
    expect(dependencies.buyerIdentity.resolve).not.toHaveBeenCalled();
    expect(dependencies.tripCatalog.findBookableById).not.toHaveBeenCalled();
  },
);

test('una identidad denegada no consulta viajes ni acreditaciones', async () => {
  const { execute, input, dependencies } = setup();
  const failure = new Error('sesión inválida');
  dependencies.buyerIdentity.resolve.mockRejectedValue(failure);
  await expect(execute(input)).rejects.toBe(failure);
  expect(dependencies.tripCatalog.findBookableById).not.toHaveBeenCalled();
});

test.each([null, {}, { ownerId: '  ' }])(
  'rechaza identidad resuelta inválida: %j',
  async (identity) => {
    const { execute, input, dependencies } = setup();
    dependencies.buyerIdentity.resolve.mockResolvedValue(identity);
    await expect(execute(input)).rejects.toMatchObject({ code: 'BOOKING_VALIDATION_ERROR' });
    expect(dependencies.tripCatalog.findBookableById).not.toHaveBeenCalled();
  },
);

test('un viaje no comercializable no acredita pasajeros ni inventa resumen', async () => {
  const { execute, input, dependencies } = setup();
  dependencies.tripCatalog.findBookableById.mockResolvedValue(null);
  await expect(execute(input)).rejects.toMatchObject({ code: 'BOOKING_TRIP_UNAVAILABLE' });
  expect(dependencies.passengerVerifier.verify).not.toHaveBeenCalled();
});

test.each(
  [
    null,
    [],
    [{ seatId: '02', birthDateVerified: true, disabilityVerified: false }],
    [
      { seatId: '02', birthDateVerified: true, disabilityVerified: false },
      { seatId: '02', birthDateVerified: true, disabilityVerified: false },
    ],
    [
      { seatId: '01', birthDateVerified: true, disabilityVerified: false },
      { seatId: 'ajeno', birthDateVerified: true, disabilityVerified: false },
    ],
    [
      { seatId: '01', birthDateVerified: true, disabilityVerified: false },
      { seatId: '02', disabilityVerified: false },
    ],
  ].map((entry) => [entry]),
)('no acepta acreditación incoherente: %j', async (entries) => {
  const { execute, input, dependencies } = setup();
  dependencies.passengerVerifier.verify.mockResolvedValue(entries);
  await expect(execute(input)).rejects.toMatchObject({ code: 'BOOKING_VALIDATION_ERROR' });
});

test.each(['2010-01-01', '1950-01-01'])(
  'edad declarada %s sin acreditar solicita revisión asistida',
  async (birthDate) => {
    const { execute, input, dependencies } = setup();
    input.passengers[0].birthDate = birthDate;
    const entries = await dependencies.passengerVerifier.verify();
    entries[0].birthDateVerified = false;
    await expect(execute(input)).rejects.toMatchObject({ code: 'BOOKING_BENEFIT_REVIEW_REQUIRED' });
  },
);

test('adulto sin beneficio por edad puede comprar sin afirmar que está acreditado', async () => {
  const { execute, input, dependencies } = setup();
  const entries = await dependencies.passengerVerifier.verify();
  entries.find((entry) => entry.seatId === '01').birthDateVerified = false;
  expect((await execute(input)).summary.passengers[0].quote.discountPercent).toBe(0);
});

test('discapacidad acreditada aplica descuento sin acumulación con edad', async () => {
  const { execute, input, dependencies } = setup();
  const entries = await dependencies.passengerVerifier.verify();
  entries.forEach((entry) => {
    entry.disabilityVerified = true;
  });
  const result = await execute(input);
  expect(result.summary.totals.totalPriceCents).toBe(502);
  expect(result.summary.passengers[1].quote.eligibleCategories).toEqual(['MINOR', 'DISABILITY']);
});

test('protege entrada y catálogo frente a mutaciones durante llamadas asíncronas', async () => {
  const { execute, input, dependencies } = setup();
  const trip = await dependencies.tripCatalog.findBookableById();
  dependencies.buyerIdentity.resolve.mockImplementation(async () => {
    input.passengers[0].fullName = 'Nombre cambiado';
    input.seatIds.push('99');
    return { ownerId: 'cliente-prueba' };
  });
  dependencies.passengerVerifier.verify.mockImplementation(async ({ passengers }) => {
    trip.segmentPricesCents[1] = 999;
    trip.cooperativeId = 'ajena';
    expect(Object.isFrozen(passengers[0])).toBe(true);
    return passengers.map(({ seatId }) => ({
      seatId,
      birthDateVerified: true,
      disabilityVerified: false,
    }));
  });
  const result = await execute(input);
  expect(result.summary.totals.totalPriceCents).toBe(752);
  expect(result.summary.cooperativeId).toBe('cooperativa-prueba');
  expect(result.summary.passengers[1].fullName).toBe('Pasajera Menor');
});

test('revisión estable ante orden de propiedades de entrada o verificaciones', async () => {
  const { execute, input, dependencies } = setup();
  const first = await execute(input);
  const entries = await dependencies.passengerVerifier.verify();
  dependencies.passengerVerifier.verify.mockResolvedValue([...entries].reverse());
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  reordered.passengers = input.passengers.map((passenger) =>
    Object.fromEntries(Object.entries(passenger).reverse()),
  );
  expect((await execute(reordered)).summaryRevision).toBe(first.summaryRevision);
});

test.each(['price', 'passenger', 'benefit', 'date', 'route', 'cooperative'])(
  'revisión cambia al cambiar %s',
  async (change) => {
    const { execute, input, dependencies } = setup();
    const before = await execute(input);
    const trip = await dependencies.tripCatalog.findBookableById();
    if (change === 'price') trip.segmentPricesCents[1] += 1;
    if (change === 'passenger') input.passengers[0].fullName = 'Otra Pasajera';
    if (change === 'benefit') {
      const entries = await dependencies.passengerVerifier.verify();
      entries[1].disabilityVerified = true;
    }
    if (change === 'date') trip.departureDate = '2026-10-29';
    if (change === 'route') input.toPosition = 4;
    if (change === 'cooperative') trip.cooperativeId = 'otra';
    expect((await execute(input)).summaryRevision).not.toBe(before.summaryRevision);
  },
);

test.each(['catalog', 'verification'])(
  'propaga fallo de %s sin resumen de respaldo',
  async (source) => {
    const { execute, input, dependencies } = setup();
    const failure = new Error('proveedor caído');
    if (source === 'catalog') dependencies.tripCatalog.findBookableById.mockRejectedValue(failure);
    else dependencies.passengerVerifier.verify.mockRejectedValue(failure);
    await expect(execute(input)).rejects.toBe(failure);
  },
);

test('rechaza reloj inválido y utiliza la fecha local provista por el adaptador', async () => {
  const { execute, input, dependencies } = setup();
  dependencies.clock.mockReturnValue(new Date('inválida'));
  await expect(execute(input)).rejects.toMatchObject({ code: 'BOOKING_VALIDATION_ERROR' });
  dependencies.clock.mockReturnValue(new Date('2026-10-29T01:00:00Z'));
  dependencies.calendarDateAt.mockReturnValue('2026-10-28');
  expect((await execute(input)).summary.departureDate).toBe('2026-10-28');
});
