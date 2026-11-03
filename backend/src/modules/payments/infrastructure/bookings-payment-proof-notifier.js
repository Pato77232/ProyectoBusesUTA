const {
  BookingNotificationUncertainError,
  PaymentProofUploadDeadlineExpiredError,
} = require('../domain/payment-proof-error');

const identifiers = Object.freeze(['bookingId', 'cooperativeId', 'paymentProofId']);
const uncertain = () => {
  throw new BookingNotificationUncertainError();
};
function exactFields(value, fields) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  );
}
function request(input) {
  if (!exactFields(input, identifiers)) uncertain();
  const copy = Object.fromEntries(identifiers.map((field) => [field, input[field]]));
  if (identifiers.some((field) => typeof copy[field] !== 'string' || !copy[field].trim()))
    uncertain();
  return Object.freeze(copy);
}
function decision(response, target) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) uncertain();
  const copy = { ...response };
  const outcome = copy.outcome;
  if (!['ACCEPTED', 'REJECTED_EXPIRED'].includes(outcome)) uncertain();
  const timeField = outcome === 'ACCEPTED' ? 'acceptedAt' : 'rejectedAt';
  if (!exactFields(copy, [...identifiers, 'outcome', timeField])) uncertain();
  if (identifiers.some((field) => copy[field] !== target[field])) uncertain();
  const value = copy[timeField];
  const date = typeof value === 'string' ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString() !== value) uncertain();
  return Object.freeze(copy);
}
function createBookingPaymentProofNotifier({ receiptReceiver } = {}) {
  if (typeof receiptReceiver?.markPaymentProofReceived !== 'function')
    throw new TypeError('Se requiere la capacidad interna de recepción de Bookings.');
  const receive = receiptReceiver.markPaymentProofReceived.bind(receiptReceiver);
  return Object.freeze({
    async markPaymentProofReceived(input) {
      const target = request(input);
      let result;
      try {
        result = decision(await receive(target), target);
      } catch {
        // Una excepción del proveedor no prueba un rechazo durable ni autoriza borrado.
        throw new BookingNotificationUncertainError();
      }
      if (result.outcome === 'REJECTED_EXPIRED') throw new PaymentProofUploadDeadlineExpiredError();
      return result;
    },
  });
}
module.exports = createBookingPaymentProofNotifier;
