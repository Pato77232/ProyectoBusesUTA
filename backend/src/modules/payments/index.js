const path = require('node:path');
const UploadPaymentProof = require('./application/upload-payment-proof.use-case');
const PgPaymentProofRepository = require('./infrastructure/pg-payment-proof.repository');
const LocalPrivateFileStorage = require('./infrastructure/local-private-file-storage');
const SimulatedBookingReader = require('./infrastructure/simulated-booking-reader');
const SimulatedBookingPaymentProofNotifier = require('./infrastructure/simulated-booking-payment-proof-notifier');
const createPaymentProofRouter = require('./interfaces/http/payment-proof.routes');

function createPaymentsModule({ pool, auth, env = process.env } = {}) {
  const paymentProofRepository = new PgPaymentProofRepository(pool);
  const fileStorage = new LocalPrivateFileStorage({
    rootDirectory:
      env.PAYMENT_PROOF_STORAGE_DIR ||
      path.resolve(__dirname, '../../../private-storage/payment-proofs'),
  });
  const bookingReader = new SimulatedBookingReader();
  const bookingPaymentProofNotifier = new SimulatedBookingPaymentProofNotifier();
  const uploadPaymentProof = new UploadPaymentProof({
    bookingReader,
    fileStorage,
    paymentProofRepository,
    bookingPaymentProofNotifier,
  });

  return {
    router: createPaymentProofRouter({ auth, uploadPaymentProof }),
    bookingReader,
    bookingPaymentProofNotifier,
  };
}

module.exports = { createPaymentsModule };
