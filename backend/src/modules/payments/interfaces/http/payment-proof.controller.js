function createPaymentProofController({
  uploadPaymentProof,
  listPendingPaymentProofs,
  readPaymentProofFile,
  approvePaymentProof,
  clock = () => new Date(),
}) {
  function contentDispositionFileName(originalFileName) {
    const encoded = encodeURIComponent(originalFileName).replace(
      /['()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return `inline; filename*=UTF-8''${encoded}`;
  }

  return {
    async listPending(request, response, next) {
      try {
        const page = await listPendingPaymentProofs.execute({
          cooperativeId: request.auth.user.cooperative_id,
          cursor: request.query.cursor || null,
        });
        return response.json({
          items: page.items.map((proof) => ({
            id: proof.id,
            bookingId: proof.booking_id,
            status: proof.status,
            fileName: proof.original_file_name,
            mediaType: proof.media_type,
            fileSizeBytes: proof.file_size_bytes,
            uploadedAt: proof.uploaded_at,
          })),
          nextCursor: page.nextCursor,
        });
      } catch (error) {
        return next(error);
      }
    },

    async readFile(request, response, next) {
      try {
        const file = await readPaymentProofFile.execute({
          paymentProofId: request.params.paymentProofId,
          cooperativeId: request.auth.user.cooperative_id,
        });
        response.set('Content-Type', file.mediaType);
        response.set('Content-Disposition', contentDispositionFileName(file.originalFileName));
        response.set('X-Content-Type-Options', 'nosniff');
        return response.send(file.content);
      } catch (error) {
        return next(error);
      }
    },

    async approve(request, response, next) {
      try {
        const proof = await approvePaymentProof.execute({
          paymentProofId: request.params.paymentProofId,
          cooperativeId: request.auth.user.cooperative_id,
          approverId: request.auth.user.id,
          now: clock(),
        });
        return response.json({
          paymentProof: {
            id: proof.id,
            decision: 'APPROVED',
            approvedAt: proof.approved_at,
          },
        });
      } catch (error) {
        return next(error);
      }
    },

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
