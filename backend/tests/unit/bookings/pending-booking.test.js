const { createPendingBooking } = require('../../../src/modules/bookings/domain/pending-booking');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');
const { summaryInput, summaryContext } = require('./helpers/booking-summary-fixtures');

function acceptedInput() {
  return { ...summaryInput(), summaryAccepted: true };
}
function creationContext() {
  return {
    ...summaryContext(),
    bookingId: 'reserva-prueba',
    ownerId: 'cliente-prueba',
    startedAt: new Date('2026-10-27T15:00:00.000Z'),
    proofWindowSeconds: 300,
  };
}

test('crea el valor inicial privado con resumen recalculado e identidad del servidor', () => {
  const booking = createPendingBooking(acceptedInput(), creationContext());
  expect(booking).toMatchObject({
    bookingId: 'reserva-prueba',
    ownerId: 'cliente-prueba',
    status: 'PENDING_PAYMENT',
    createdAt: '2026-10-27T15:00:00.000Z',
    expiresAt: '2026-10-27T15:05:00.000Z',
    summary: { cooperativeId: 'cooperativa-prueba', totals: { totalPriceCents: 752 } },
  });
  expect(booking.summary.passengers).toHaveLength(2);
  expect(booking).not.toHaveProperty('summaryAccepted');
});

test.each([undefined, false, null, 'true', 1])(
  'no crea reserva con aceptación %j',
  (summaryAccepted) => {
    expect(() =>
      createPendingBooking({ ...summaryInput(), summaryAccepted }, creationContext()),
    ).toThrow(BookingValidationError);
  },
);

test.each([
  'bookingId',
  'ownerId',
  'cooperativeId',
  'status',
  'createdAt',
  'expiresAt',
  'proofWindowSeconds',
  'totalPriceCents',
  'summary',
])('rechaza %s enviado en la entrada del cliente', (field) => {
  expect(() =>
    createPendingBooking({ ...acceptedInput(), [field]: 'inyectado' }, creationContext()),
  ).toThrow(BookingValidationError);
});

test.each([
  { bookingId: '' },
  { bookingId: ' ' },
  { bookingId: 1 },
  { ownerId: '' },
  { ownerId: null },
  { ownerId: 1 },
  { startedAt: undefined },
  { startedAt: '2026-10-27T15:00:00.000Z' },
  { startedAt: new Date(NaN) },
  { proofWindowSeconds: undefined },
  { proofWindowSeconds: 179 },
  { proofWindowSeconds: 301 },
  { proofWindowSeconds: 180.5 },
  { proofWindowSeconds: '300' },
])('rechaza identidad, reloj o plazo inválidos: %j', (change) => {
  expect(() => createPendingBooking(acceptedInput(), { ...creationContext(), ...change })).toThrow(
    BookingValidationError,
  );
});

test.each([
  [180, '2026-10-27T15:03:00.000Z'],
  [300, '2026-10-27T15:05:00.000Z'],
])('acepta plazo explícito %i segundos', (proofWindowSeconds, expiresAt) => {
  expect(
    createPendingBooking(acceptedInput(), { ...creationContext(), proofWindowSeconds }).expiresAt,
  ).toBe(expiresAt);
});

test('el plazo comienza al construir el valor aceptado y no al consultar el resumen', () => {
  const context = creationContext();
  context.startedAt = new Date('2026-10-27T15:07:00.000Z');
  expect(createPendingBooking(acceptedInput(), context)).toMatchObject({
    createdAt: '2026-10-27T15:07:00.000Z',
    expiresAt: '2026-10-27T15:12:00.000Z',
  });
});

test('rechaza desbordamiento de la fecha límite sin crear un estado parcial', () => {
  expect(() =>
    createPendingBooking(acceptedInput(), {
      ...creationContext(),
      startedAt: new Date(8640000000000000),
    }),
  ).toThrow(BookingValidationError);
});

test('vuelve a validar el inventario y el resumen en la aceptación', () => {
  const context = creationContext();
  context.trip.seatIds = ['01'];
  expect(() => createPendingBooking(acceptedInput(), context)).toThrow(BookingValidationError);
});

test('usa la tarifa actual del contexto y no conserva una cotización anterior', () => {
  const context = creationContext();
  context.trip.segmentPricesCents[1] = 400;
  expect(createPendingBooking(acceptedInput(), context).summary.totals.totalPriceCents).toBe(1052);
});

test('congela el resultado y no comparte el reloj ni los datos mutables del servidor', () => {
  const input = acceptedInput();
  const context = creationContext();
  const before = context.startedAt.getTime();
  const booking = createPendingBooking(input, context);
  expect(context.startedAt.getTime()).toBe(before);
  expect(input.summaryAccepted).toBe(true);
  context.startedAt.setTime(0);
  context.trip.segmentPricesCents[1] = 9999;
  input.passengers[0].fullName = 'Modificado';
  expect(booking.createdAt).toBe('2026-10-27T15:00:00.000Z');
  expect(booking.expiresAt).toBe('2026-10-27T15:05:00.000Z');
  expect(booking.summary.totals.totalPriceCents).toBe(752);
  expect(Object.isFrozen(booking)).toBe(true);
  expect(Object.isFrozen(booking.summary)).toBe(true);
  expect(Object.isFrozen(booking.summary.passengers)).toBe(true);
});
