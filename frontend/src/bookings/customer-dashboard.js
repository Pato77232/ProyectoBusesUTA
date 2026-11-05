// FRONT-02 T10: panel del cliente con sus viajes próximos y recientes.
export const DASHBOARD_HISTORY_LIMIT = 50;
export const RECENT_TRIPS_SHOWN = 5;

const ACTIVE = new Set(["SOLD", "PENDING_PAYMENT"]);
const STATUS_LABELS = Object.freeze({
  SOLD: "Pagado",
  PENDING_PAYMENT: "Pendiente de comprobante",
  EXPIRED: "Vencida",
  REJECTED: "Comprobante rechazado",
});

function routeOf(item) {
  const points = item?.summary?.commercial?.routePoints;
  const from = item?.fromPosition;
  const to = item?.toPosition;
  if (!Array.isArray(points)) return null;
  const origin = points.find((point) => point?.position === from);
  const destination = points.find((point) => point?.position === to);
  const departure = Date.parse(origin?.departureAt);
  if (
    typeof origin?.locationKey !== "string" ||
    typeof destination?.locationKey !== "string" ||
    !Number.isFinite(departure)
  )
    return null;
  return {
    origin: origin.locationKey,
    destination: destination.locationKey,
    departureAt: origin.departureAt,
    departure,
  };
}

// Una reserva sin datos de recorrido verificables se omite: no se inventa el viaje.
export function toTrip(item) {
  const route = routeOf(item);
  if (
    !route ||
    !STATUS_LABELS[item.status] ||
    typeof item.bookingId !== "string"
  )
    return null;
  return {
    bookingId: item.bookingId,
    status: item.status,
    statusLabel: STATUS_LABELS[item.status],
    origin: route.origin,
    destination: route.destination,
    departureAt: route.departureAt,
    departure: route.departure,
    passengers: Array.isArray(item.summary?.passengers)
      ? item.summary.passengers.length
      : 0,
    totalPriceCents: item.totalPriceCents,
  };
}

export function splitTrips(items, now) {
  const trips = (Array.isArray(items) ? items : []).map(toTrip).filter(Boolean);
  const upcoming = trips
    .filter((trip) => ACTIVE.has(trip.status) && trip.departure >= now)
    .sort((a, b) => a.departure - b.departure);
  const upcomingIds = new Set(upcoming.map((trip) => trip.bookingId));
  const recent = trips
    .filter((trip) => !upcomingIds.has(trip.bookingId))
    .sort((a, b) => b.departure - a.departure)
    .slice(0, RECENT_TRIPS_SHOWN);
  return { upcoming, recent };
}

export function tripAction(trip) {
  if (trip.status === "SOLD")
    return {
      href:
        "/pages/boletos.html?" +
        new URLSearchParams({ reserva: trip.bookingId }),
      label: "Ver boletos",
    };
  return { href: "/pages/historial-reservas.html", label: "Ver reserva" };
}
