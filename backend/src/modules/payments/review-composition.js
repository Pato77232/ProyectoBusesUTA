const path = require('node:path');
const BookingsPaymentQueryAdapter = require('./infrastructure/bookings-payment-query-adapter');
const PgPaymentProofRepository = require('./infrastructure/pg-payment-proof.repository');
const LocalPrivateFileStorage = require('./infrastructure/local-private-file-storage');
const ListAuthorizedPaymentProofs = require('./application/list-authorized-payment-proofs.use-case');
const ReadPaymentProofFile = require('./application/read-payment-proof-file.use-case');
const createPaymentReviewRouter = require('./interfaces/http/payment-review.routes');

/** Composición de lectura explícita; requiere la API pública real del proveedor. */
function createPaymentReviewModule({ pool, auth, paymentQueries, env = process.env } = {}) {
  const bookingReader = new BookingsPaymentQueryAdapter({ paymentQueries });
  const paymentProofRepository = new PgPaymentProofRepository(pool);
  const fileReader = new LocalPrivateFileStorage({
    rootDirectory:
      env.PAYMENT_PROOF_STORAGE_DIR ||
      path.resolve(__dirname, '../../../private-storage/payment-proofs'),
  });
  return {
    router: createPaymentReviewRouter({
      auth,
      listPaymentProofs: new ListAuthorizedPaymentProofs({ paymentProofRepository, bookingReader }),
      readPaymentProofFile: new ReadPaymentProofFile({ paymentProofRepository, fileReader }),
    }),
  };
}

module.exports = createPaymentReviewModule;
