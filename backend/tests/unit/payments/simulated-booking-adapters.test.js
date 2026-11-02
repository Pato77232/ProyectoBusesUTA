const SimulatedBookingReader = require('../../../src/modules/payments/infrastructure/simulated-booking-reader');
const SimulatedBookingPaymentProofNotifier = require('../../../src/modules/payments/infrastructure/simulated-booking-payment-proof-notifier');
const SimulatedBookingSaleConfirmer = require('../../../src/modules/payments/infrastructure/simulated-booking-sale-confirmer');
const {
  BookingPaymentProofRejectedError,
  BookingSaleRejectedError,
} = require('../../../src/modules/payments/domain/payment-proof-error');

test('el lector simulado solo devuelve reservas configuradas', async () => {
  // Arrange
  const booking = { bookingId: 'booking-1', ownerId: 'customer-1' };
  const reader = new SimulatedBookingReader([booking]);

  // Act / Assert
  await expect(reader.findForPayment('booking-1')).resolves.toBe(booking);
  await expect(reader.findForPayment('booking-unknown')).resolves.toBeNull();
});

test('el confirmador simulado conserva la idempotencia por comprobante', async () => {
  const confirmer = new SimulatedBookingSaleConfirmer();
  const sale = {
    bookingId: 'booking-1',
    cooperativeId: 'cooperative-1',
    paymentProofId: 'proof-1',
  };

  await expect(confirmer.confirmSale(sale)).resolves.toBe(true);
  await expect(confirmer.confirmSale(sale)).resolves.toBe(true);
  await expect(
    confirmer.confirmSale({ ...sale, bookingId: 'booking-other' }),
  ).rejects.toBeInstanceOf(BookingSaleRejectedError);

  expect(confirmer.confirmedProofIds).toEqual(new Set(['proof-1']));
  expect(confirmer.confirmedSales).toEqual(new Map([['proof-1', sale]]));
});

test('el confirmador simulado puede rechazar definitivamente una reserva', async () => {
  const confirmer = new SimulatedBookingSaleConfirmer({ rejections: ['proof-rejected'] });

  await expect(
    confirmer.confirmSale({
      bookingId: 'booking-1',
      cooperativeId: 'cooperative-1',
      paymentProofId: 'proof-rejected',
    }),
  ).rejects.toBeInstanceOf(BookingSaleRejectedError);
});

test('el notificador simulado acepta reintentos y permite simular un rechazo definitivo', async () => {
  // Arrange
  const notifier = new SimulatedBookingPaymentProofNotifier();

  // Act
  const receipt = {
    bookingId: 'booking-1',
    cooperativeId: 'cooperative-1',
    paymentProofId: 'proof-1',
  };
  await notifier.markPaymentProofReceived(receipt);
  await notifier.markPaymentProofReceived(receipt);
  await expect(
    notifier.markPaymentProofReceived({ ...receipt, bookingId: 'booking-other' }),
  ).rejects.toBeInstanceOf(BookingPaymentProofRejectedError);
  notifier.rejectDefinitively('proof-2');

  // Assert
  expect(notifier.receivedProofs).toEqual(new Map([['proof-1', receipt]]));
  await expect(
    notifier.markPaymentProofReceived({ ...receipt, paymentProofId: 'proof-2' }),
  ).rejects.toBeInstanceOf(BookingPaymentProofRejectedError);
});
