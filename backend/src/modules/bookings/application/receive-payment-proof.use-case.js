const { request, verifiedSource } = require('../domain/booking-lifecycle');
const BookingLifecycleError = require('../domain/booking-lifecycle-error');
function receivePaymentProof({ repository, receiptSource, clock }) {
  if (typeof receiptSource !== 'function')
    throw new TypeError('Se requiere una fuente interna de comprobante persistido.');
  return async (input) => {
    const target = request(input);
    const previous = await repository.findReceipt(target);
    if (previous) return previous;
    let source;
    try {
      source = await receiptSource(Object.freeze({ paymentProofId: target.paymentProofId }));
    } catch {
      throw new BookingLifecycleError();
    }
    verifiedSource(source, target);
    return repository.receive(target, clock);
  };
}
module.exports = receivePaymentProof;
