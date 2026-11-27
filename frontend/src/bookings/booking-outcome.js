// FRONT-02 T13: cómo se presenta al cliente cada estado de su reserva.
// Solo es presentación: el servidor decide el estado y si admite comprobantes.

const OUTCOMES = Object.freeze({
  PENDING_PAYMENT: {
    title: "La reserva está registrada",
    status: "Estado: pendiente de comprobante.",
  },
  SOLD: {
    title: "Tu compra está aprobada",
    status: "Estado: compra aprobada. Tus boletos ya están disponibles.",
  },
  REJECTED: {
    title: "El pago no fue aprobado",
    status:
      "Estado: rechazada. La cooperativa no aprobó el comprobante y los asientos se liberaron. Si aún necesitas viajar, elige tus asientos de nuevo.",
    restart: true,
  },
  EXPIRED: {
    title: "La reserva venció",
    status:
      "Estado: vencida. El plazo para subir el comprobante terminó y los asientos se liberaron. Si aún necesitas viajar, elige tus asientos de nuevo.",
    restart: true,
  },
});

const PENDING_DEADLINE_PASSED =
  "El plazo para subir el comprobante terminó. Pulsa Actualizar estado para confirmar el resultado.";
const UNKNOWN = {
  title: "La reserva está registrada",
  status: "Estado pendiente de actualización.",
};

export function bookingOutcome(booking, now = Date.now()) {
  const known = OUTCOMES[booking?.status] ?? UNKNOWN;
  const pending = booking?.status === "PENDING_PAYMENT";
  const deadline = Date.parse(booking?.expiresAt);
  const deadlinePassed =
    pending && Number.isFinite(deadline) && deadline <= now;
  return {
    title: known.title,
    status: deadlinePassed ? PENDING_DEADLINE_PASSED : known.status,
    canUploadProof: pending && !deadlinePassed,
    restart: known.restart === true,
    showTickets: booking?.status === "SOLD",
  };
}

// Relaciona cada asiento interno con su número visible del mapa del bus.
export function seatLabels(seats) {
  const labels = new Map();
  for (const seat of Array.isArray(seats) ? seats : []) {
    if (typeof seat?.seatId === "string" && Number.isInteger(seat.label))
      labels.set(seat.seatId, seat.label);
  }
  return labels;
}

export function passengerSeatText(seatId, labels) {
  const label = labels?.get?.(seatId);
  return label === undefined ? "asiento asignado" : "asiento " + label;
}
