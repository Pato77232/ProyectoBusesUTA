function createPaymentProofController({ uploadPaymentProof, clock = () => new Date() }) {
  return {
    async upload(request, response, next) {
      try {
        const result = await uploadPaymentProof.execute({
          bookingId: request.paymentProofInput.bookingId,
          customerId: request.auth.user.id,
          file: request.paymentProofInput.file,
          now: clock(),
        });

        return response.status(201).json({
          paymentProof: {
            id: result.paymentProof.id,
            status: result.paymentProof.status,
            expiresAt: result.expiresAt,
          },
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = createPaymentProofController;
