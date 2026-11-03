const {
  validateRequestKey,
  bookingCreationFingerprint,
  createBookingOperation,
} = require('../../../src/modules/bookings/domain/booking-creation-request');
const { summaryInput } = require('./helpers/booking-summary-fixtures');

const key = '00000000-0000-4000-8000-000000000001';
const revision = 'a'.repeat(64);

test.each([
  undefined,
  null,
  '',
  ' ',
  1,
  key.toUpperCase().replace('4000', '4ABC'),
  key + ' ',
  key.replace('4000', '1000'),
  key.replace('8000', '7000'),
])('rechaza clave inválida: %j', (value) => {
  expect(() => validateRequestKey(value)).toThrow(
    expect.objectContaining({
      code: 'BOOKING_VALIDATION_ERROR',
    }),
  );
});

test('clave válida no es transformada y la operación copia identidad normalizada', () => {
  const input = { ownerId: ' comprador ', requestKey: key, requestFingerprint: revision };
  const operation = createBookingOperation(input);
  expect(operation).toEqual({
    ownerId: 'comprador',
    requestKey: key,
    requestFingerprint: revision,
  });
  input.ownerId = 'otro';
  expect(Object.isFrozen(operation)).toBe(true);
  expect(operation.ownerId).toBe('comprador');
});

test.each([
  null,
  {},
  { ownerId: ' ', requestKey: key, requestFingerprint: revision },
  { ownerId: 'x', requestKey: key, requestFingerprint: 'A'.repeat(64) },
])('operación inválida no puede llegar a infraestructura: %j', (value) => {
  expect(() => createBookingOperation(value)).toThrow(
    expect.objectContaining({
      code: 'BOOKING_VALIDATION_ERROR',
    }),
  );
});

test('huella no cambia por orden JSON ni orden de pasajeros para los mismos asientos', () => {
  const input = summaryInput();
  const expected = bookingCreationFingerprint(input, revision);
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  reordered.passengers = [...input.passengers]
    .reverse()
    .map((passenger) => Object.fromEntries(Object.entries(passenger).reverse()));
  expect(bookingCreationFingerprint(reordered, revision)).toBe(expected);
  expect(input.passengers[0].seatId).toBe('02');
  expect(expected).toMatch(/^[a-f0-9]{64}$/);
  expect(expected).not.toContain('Pasajera');
});

test.each(['trip', 'route', 'seats', 'name', 'identification', 'birthDate', 'revision'])(
  'huella detecta cambio en %s sin guardar la entrada privada',
  (field) => {
    const input = summaryInput();
    const original = bookingCreationFingerprint(input, revision);
    if (field === 'trip') input.tripId = 'otro';
    if (field === 'route') input.toPosition = 4;
    if (field === 'seats') input.seatIds.reverse();
    if (field === 'name') input.passengers[0].fullName = 'Otra Persona';
    if (field === 'identification') input.passengers[0].identificationNumber = '0200000008';
    if (field === 'birthDate') input.passengers[0].birthDate = '2011-01-01';
    expect(
      bookingCreationFingerprint(input, field === 'revision' ? 'b'.repeat(64) : revision),
    ).not.toBe(original);
  },
);
