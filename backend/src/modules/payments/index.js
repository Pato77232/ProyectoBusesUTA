const path = require('node:path');
const PgPaymentProofReceiptSource = require('./infrastructure/pg-payment-proof-receipt-source');
const BookingsPaymentProofNotifier = require('./infrastructure/bookings-payment-proof-notifier');
const UploadPaymentProof = require('./application/upload-payment-proof.use-case');
const ListPendingPaymentProofs = require('./application/list-pending-payment-proofs.use-case');
const ReadPaymentProofFile = require('./application/read-payment-proof-file.use-case');
const ApprovePaymentProof = require('./application/approve-payment-proof.use-case');
const PgPaymentProofRepository = require('./infrastructure/pg-payment-proof.repository');
const LocalPrivateFileStorage = require('./infrastructure/local-private-file-storage');
const SimulatedBookingReader = require('./infrastructure/simulated-booking-reader');
const SimulatedBookingPaymentProofNotifier = require('./infrastructure/simulated-booking-payment-proof-notifier');
const SimulatedBookingSaleConfirmer = require('./infrastructure/simulated-booking-sale-confirmer');
const createPaymentProofRouter = require('./interfaces/http/payment-proof.routes');

function createPaymentsModule({
  pool,
  auth,
  env = process.env,
  bookingPaymentProofNotifier,
  bookingSaleConfirmer,
} = {}) {
  const paymentProofRepository = new PgPaymentProofRepository(pool);
  const fileStorage = new LocalPrivateFileStorage({
    rootDirectory:
      env.PAYMENT_PROOF_STORAGE_DIR ||
      path.resolve(__dirname, '../../../private-storage/payment-proofs'),
  });
  const bookingReader = new SimulatedBookingReader();
  const notifier = bookingPaymentProofNotifier || new SimulatedBookingPaymentProofNotifier();
  const saleConfirmer = bookingSaleConfirmer || new SimulatedBookingSaleConfirmer();
  const uploadPaymentProof = new UploadPaymentProof({
    bookingReader,
    fileStorage,
    paymentProofRepository,
    bookingPaymentProofNotifier: notifier,
  });
  const listPendingPaymentProofs = new ListPendingPaymentProofs({
    paymentProofRepository,
    bookingReader,
  });
  const readPaymentProofFile = new ReadPaymentProofFile({
    paymentProofRepository,
    fileReader: fileStorage,
  });
  const approvePaymentProof = new ApprovePaymentProof({
    paymentProofRepository,
    bookingSaleConfirmer: saleConfirmer,
  });

  return {
    router: createPaymentProofRouter({
      auth,
      uploadPaymentProof,
      listPendingPaymentProofs,
      readPaymentProofFile,
      approvePaymentProof,
    }),
    bookingReader,
    bookingPaymentProofNotifier,
    bookingSaleConfirmer,
  };
}

function createPaymentReceiptModule({ pool, createPaymentProofReceiver } = {}) {
  if (typeof pool?.query !== 'function' || typeof createPaymentProofReceiver !== 'function')
    throw new TypeError('Se requieren persistencia y receptor público de Reservas.');
  const source = new PgPaymentProofReceiptSource({ pool });
  const paymentProofQueries = Object.freeze({
    findForBookingReceipt: source.findForBookingReceipt.bind(source),
  });
  const receiver = createPaymentProofReceiver({
    receiptSource: paymentProofQueries.findForBookingReceipt,
  });
  return Object.freeze({
    paymentProofQueries,
    bookingPaymentProofNotifier: new BookingsPaymentProofNotifier({ receiver }),
  });
}

module.exports = {
  createPaymentsModule,
  createPaymentReceiptModule,
  createBookingPaymentProofNotifier: require('./infrastructure/create-booking-payment-proof-notifier'),
  createPaymentReviewModule: require('./review-composition'),
};
