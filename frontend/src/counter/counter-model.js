import { cedulaProblem } from "../bookings/cedula.js";

// BOOK-CAJA-02: reglas de presentación de la boletería. El servidor vuelve a validar
// cooperativa, asientos, acreditación, importe y plazo.
const MAX_NAME = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

/** La búsqueda es pública; la boletería solo ofrece los viajes de su cooperativa. */
export function ownTrips(trips, cooperativeId) {
  if (!Array.isArray(trips) || !UUID.test(cooperativeId ?? "")) return [];
  const own = cooperativeId.toLowerCase();
  return trips.filter((trip) => trip?.cooperativeId?.toLowerCase() === own);
}

export function tripContext(trip) {
  return {
    tripId: trip.tripId,
    fromPosition: trip.fromPosition,
    toPosition: trip.toPosition,
  };
}

/** Devuelve el primer problema del pasajero, o null si el formulario está completo. */
export function passengerProblem(passenger) {
  const name = (passenger?.fullName ?? "").trim();
  if (!name) return "Escribe el nombre completo del pasajero.";
  if (name.length > MAX_NAME) return "El nombre es demasiado largo.";
  const cedula = cedulaProblem(passenger.identificationNumber);
  if (cedula) return cedula;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(passenger.birthDate ?? ""))
    return "Indica la fecha de nacimiento.";
  return null;
}

export function saleRequest(context, passengers) {
  return {
    ...context,
    seatIds: passengers.map((p) => p.seatId),
    passengers: passengers.map((p) => ({
      seatId: p.seatId,
      identificationNumber: p.identificationNumber.trim(),
      fullName: p.fullName.trim(),
      birthDate: p.birthDate,
    })),
    decisions: passengers.map((p) => ({
      seatId: p.seatId,
      birthDateVerified: p.birthDateVerified === true,
      disabilityVerified: p.disabilityVerified === true,
    })),
  };
}

const MESSAGES = Object.freeze({
  BOOKING_SEAT_CONFLICT:
    "Uno de los asientos se ocupó mientras tanto. Actualiza el mapa y elige otro.",
  BOOKING_SUMMARY_CHANGED:
    "El total cambió. Revisa el resumen de nuevo antes de confirmar.",
  BOOKING_BENEFIT_REVIEW_REQUIRED:
    "Falta comprobar la fecha de nacimiento de algún pasajero con su cédula.",
  BOOKING_TRIP_UNAVAILABLE:
    "Este viaje ya no está disponible en tu cooperativa. Busca otro.",
  BOOKING_VALIDATION_ERROR:
    "Algún dato no es válido. Revisa la cédula, el nombre y la fecha de nacimiento.",
  BOOKING_CASH_EXPIRED:
    "El plazo para cobrar terminó y los asientos se liberaron. Empieza una venta nueva.",
  BOOKING_CASH_CONFLICT:
    "No se pudo registrar el cobro: revisa el importe o si la venta ya se cobró.",
  BOOKING_CASH_UNCERTAIN:
    "No pudimos confirmar el cobro. Pulsa «Registrar cobro» otra vez: se usa el mismo recibo y no se cobra dos veces.",
  BOOKING_CASH_NOT_FOUND: "No encontramos esta venta en tu cooperativa.",
});

export function counterMessage(error) {
  if (error?.status === 401) return "Tu sesión terminó. Inicia sesión otra vez.";
  if (error?.code === "CSRF_TOKEN_INVALID")
    return "La protección del formulario se renovó. Pulsa el botón otra vez; no se duplica la operación.";
  if (error?.status === 403)
    return "La boletería es solo para oficinistas de la cooperativa.";
  if (MESSAGES[error?.code]) return MESSAGES[error.code];
  if (!error?.status || error.status >= 500)
    return "No hay respuesta del servidor. Revisa la conexión e inténtalo de nuevo.";
  return "No se pudo completar la acción. Inténtalo de nuevo.";
}
