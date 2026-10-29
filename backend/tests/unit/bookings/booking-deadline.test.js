const {
  createBookingDeadline,
  hasBookingDeadlineElapsed,
} = require('../../../src/modules/bookings/domain/booking-deadline');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');

const startedAt = new Date('2026-10-20T15:00:00.000Z');
const expiresAt = new Date('2026-10-20T15:05:00.000Z');

test.each([
  [180, '2026-10-20T15:03:00.000Z'],
  [240, '2026-10-20T15:04:00.000Z'],
  [300, '2026-10-20T15:05:00.000Z'],
])('calcula vencimiento con plazo configurado de %i segundos', (seconds, expected) => {
  expect(createBookingDeadline(startedAt, seconds).toISOString()).toBe(expected);
  expect(startedAt.toISOString()).toBe('2026-10-20T15:00:00.000Z');
});

test.each([undefined, null, 0, 179, 301, 200.5, '300', Infinity, NaN])(
  'rechaza plazo inválido sin usar un valor oculto por defecto: %j',
  (seconds) => {
    expect(() => createBookingDeadline(startedAt, seconds)).toThrow(BookingValidationError);
  },
);

test.each([undefined, null, '2026-10-20', new Date(NaN)])('rechaza fecha inválida: %j', (date) => {
  expect(() => createBookingDeadline(date, 300)).toThrow(BookingValidationError);
  expect(() =>
    hasBookingDeadlineElapsed({ expiresAt: date, now: startedAt, hasPaymentProof: false }),
  ).toThrow(BookingValidationError);
  expect(() => hasBookingDeadlineElapsed({ expiresAt, now: date, hasPaymentProof: false })).toThrow(
    BookingValidationError,
  );
});

test('no expira un milisegundo antes y expira en el límite sin comprobante', () => {
  expect(
    hasBookingDeadlineElapsed({
      expiresAt,
      now: new Date(expiresAt.getTime() - 1),
      hasPaymentProof: false,
    }),
  ).toBe(false);
  expect(hasBookingDeadlineElapsed({ expiresAt, now: expiresAt, hasPaymentProof: false })).toBe(
    true,
  );
});

test('con comprobante mantiene la reserva durante la revisión aunque haya pasado el plazo', () => {
  expect(
    hasBookingDeadlineElapsed({
      expiresAt,
      now: new Date('2026-10-21T15:00:00Z'),
      hasPaymentProof: true,
    }),
  ).toBe(false);
});

test.each([undefined, null, 0, 'false'])(
  'no interpreta un dato ausente como sin comprobante: %j',
  (hasPaymentProof) => {
    expect(() => hasBookingDeadlineElapsed({ expiresAt, now: expiresAt, hasPaymentProof })).toThrow(
      BookingValidationError,
    );
  },
);

test('rechaza desbordamiento de fecha', () => {
  expect(() => createBookingDeadline(new Date(8640000000000000), 300)).toThrow(
    BookingValidationError,
  );
});

test('el resultado no comparte el objeto de inicio', () => {
  const deadline = createBookingDeadline(startedAt, 300);
  deadline.setTime(0);
  expect(startedAt.toISOString()).toBe('2026-10-20T15:00:00.000Z');
});
