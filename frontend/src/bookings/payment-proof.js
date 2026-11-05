// FRONT-02 T6: carga del comprobante (PAGOS-01) desde la reserva del cliente.
export const PROOF_MEDIA_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
// Igual a MAX_FILE_SIZE_BYTES de payments; el backend vuelve a validarlo.
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export function validateProofFile(file) {
  if (!file) return "Elige el archivo del comprobante.";
  if (!PROOF_MEDIA_TYPES.includes(file.type))
    return "El comprobante debe ser una imagen JPG o PNG, o un PDF.";
  if (file.size === 0) return "El archivo está vacío. Elige otro.";
  if (file.size > MAX_PROOF_BYTES)
    return "El comprobante supera 5 MB. Elige un archivo más liviano.";
  return null;
}

const MESSAGES = Object.freeze({
  PAYMENT_PROOF_ALREADY_UPLOADED:
    "Ya recibimos un comprobante para esta reserva. La cooperativa lo revisará.",
  PAYMENT_PROOF_UPLOAD_DEADLINE_EXPIRED:
    "El plazo para subir el comprobante terminó. Los asientos se liberarán.",
  PAYMENT_PROOF_EXPIRED:
    "El plazo para subir el comprobante terminó. Los asientos se liberarán.",
  BOOKING_NOT_PAYABLE:
    "Esta reserva ya no admite comprobantes. Pulsa Actualizar estado para ver su situación.",
  PAYMENT_PROOF_VALIDATION_ERROR:
    "El archivo no es un comprobante válido. Usa un JPG, PNG o PDF de hasta 5 MB.",
  INVALID_MULTIPART_FORM:
    "No se pudo leer el archivo. Elige el comprobante otra vez.",
  PAYMENT_PROOF_NOT_FOUND: "No encontramos esta reserva para tu cuenta.",
  UNAUTHENTICATED:
    "Tu sesión terminó. Inicia sesión para subir el comprobante.",
});

export function proofMessage(error) {
  if (error?.status === 413)
    return "El comprobante supera el tamaño permitido. Elige un archivo más liviano.";
  if (MESSAGES[error?.code]) return MESSAGES[error.code];
  if (error?.code === "PAYMENT_PROOF_PERSISTENCE_UNCERTAIN" || !error?.status)
    return "No pudimos confirmar la carga. Pulsa Actualizar estado antes de volver a intentarlo.";
  return "No se pudo subir el comprobante. Inténtalo de nuevo.";
}

export function proofFormData(bookingId, file) {
  const form = new globalThis.FormData();
  form.append("bookingId", bookingId);
  form.append("file", file, file.name || "comprobante");
  return form;
}

export function isUploadedProof(result) {
  return (
    typeof result?.paymentProof?.id === "string" &&
    result.paymentProof.id.length > 0 &&
    typeof result.paymentProof.status === "string"
  );
}
