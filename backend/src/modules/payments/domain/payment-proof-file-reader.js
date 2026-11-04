/** Puerto para leer un comprobante privado después de autorizar su cooperativa. */
class PaymentProofFileReader {
  async read() {
    throw new Error('PaymentProofFileReader.read debe implementarse.');
  }
}

module.exports = PaymentProofFileReader;
