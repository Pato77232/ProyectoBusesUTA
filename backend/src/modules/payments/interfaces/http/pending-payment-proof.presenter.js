function pendingPaymentProofPage(page) {
  return {
    items: page.items.map((proof) => ({
      id: proof.id,
      bookingId: proof.booking_id,
      totalCents: proof.total_cents,
      currency: 'USD',
      status: proof.status,
      fileName: proof.original_file_name,
      mediaType: proof.media_type,
      fileSizeBytes: proof.file_size_bytes,
      uploadedAt: proof.uploaded_at,
    })),
    nextCursor: page.nextCursor,
  };
}

module.exports = pendingPaymentProofPage;
