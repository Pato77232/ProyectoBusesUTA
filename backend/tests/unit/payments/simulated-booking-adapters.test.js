const SimulatedBookingReader = require('../../../src/modules/payments/infrastructure/simulated-booking-reader');
const SimulatedBookingPaymentProofNotifier = require('../../../src/modules/payments/infrastructure/simulated-booking-payment-proof-notifier');
const { BookingPaymentProofRejectedError } = require('../../../src/modules/payments/domain/payment-proof-error');

test('el lector simulado solo devuelve reservas configuradas', async () => {
  // Arrange
  const booking = { bookingId: 'booking-1', ownerId: 'customer-1' };
  const reader = new SimulatedBookingReader([booking]);

  // Act / Assert
  await expect(reader.findForPayment('booking-1')).resolves.toBe(booking);
  await expect(reader.findForPayment('booking-unknown')).resolves.toBeNull();
});

test('el notificador simulado acepta reintentos y permite simular un rechazo definitivo', async () => {
  // Arrange
  const notifier = new SimulatedBookingPaymentProofNotifier();

  // Act
  await notifier.markPaymentProofReceived('booking-1');
  await notifier.markPaymentProofReceived('booking-1');
  notifier.rejectDefinitively('booking-2');

  // Assert
  expect(notifier.receivedBookingIds).toEqual(new Set(['booking-1']));
  await expect(notifier.markPaymentProofReceived('booking-2')).rejects.toBeInstanceOf(
    BookingPaymentProofRejectedError,
  );
});
