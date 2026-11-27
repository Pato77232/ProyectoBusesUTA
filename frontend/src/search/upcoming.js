// SEARCH-02: próximas salidas sin escribir origen, destino y fecha.
const ZONE = 'America/Guayaquil';
const UPCOMING_PATH = '/api/v1/trips/upcoming';
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const dayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const dayTitle = new Intl.DateTimeFormat('es-EC', {
  timeZone: ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Fecha local de Ecuador (YYYY-MM-DD) del instante dado. */
export function ecuadorDate(instant) {
  return dayKey.format(new Date(instant));
}

/** Suma días a una fecha YYYY-MM-DD sin depender de la zona del navegador. */
export function shiftDate(date, days) {
  if (!DATE.test(date)) return date;
  return new Date(Date.parse(date + 'T12:00:00Z') + days * DAY_MS).toISOString().slice(0, 10);
}

export function dayLabel(date, now = Date.now()) {
  const today = ecuadorDate(now);
  if (date === today) return 'Hoy';
  if (date === shiftDate(today, 1)) return 'Mañana';
  const title = dayTitle.format(new Date(date + 'T17:00:00Z'));
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** Agrupa por día local de salida, en orden de salida. */
export function groupByDay(trips, now = Date.now()) {
  const groups = new Map();
  for (const trip of trips) {
    const key = ecuadorDate(trip.boardingAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trip);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, label: dayLabel(date, now), trips: list }));
}

export function stopsText(count) {
  if (count === 0) return 'Directo';
  return count === 1 ? '1 parada' : `${count} paradas`;
}

function validTrip(t) {
  return (
    !!t &&
    /^[a-f0-9-]{36}$/i.test(t.tripId) &&
    typeof t.cooperativeName === 'string' &&
    t.cooperativeName.trim() &&
    typeof t.origin === 'string' &&
    typeof t.destination === 'string' &&
    Number.isSafeInteger(t.fromPosition) &&
    Number.isSafeInteger(t.toPosition) &&
    t.fromPosition >= 0 &&
    t.toPosition > t.fromPosition &&
    Number.isSafeInteger(t.stopCount) &&
    t.stopCount >= 0 &&
    Number.isFinite(Date.parse(t.boardingAt)) &&
    Number.isFinite(Date.parse(t.arrivalAt)) &&
    Date.parse(t.arrivalAt) > Date.parse(t.boardingAt) &&
    t.currency === 'USD' &&
    Number.isSafeInteger(t.amountCents) &&
    t.amountCents > 0
  );
}

export function createUpcomingController({ client, view }) {
  let busy = false;
  return {
    async load({ date, cooperativeId } = {}) {
      if (busy) return;
      busy = true;
      view.busy(true);
      view.show('loading', 'Consultando las próximas salidas…', []);
      try {
        const query = new URLSearchParams();
        if (date) query.set('date', date);
        if (cooperativeId) query.set('cooperativeId', cooperativeId);
        const suffix = query.toString() ? '?' + query : '';
        const result = await client.request(UPCOMING_PATH + suffix);
        if (
          !Array.isArray(result?.trips) ||
          typeof result.truncated !== 'boolean' ||
          !result.trips.every(validTrip)
        )
          throw new Error('Respuesta inválida');
        const days = Number.isSafeInteger(result.days) ? result.days : 7;
        const empty = date
          ? 'No hay salidas a la venta para ese día.'
          : `No hay salidas a la venta en los próximos ${days} días.`;
        view.show(
          result.trips.length ? 'ready' : 'empty',
          result.truncated
            ? 'Se muestran las primeras salidas. Busca por ciudades o elige un día para ver el resto.'
            : result.trips.length
              ? 'Elige una salida para ver sus asientos.'
              : empty,
          result.trips,
        );
      } catch {
        view.show('error', 'No se pudieron consultar las próximas salidas. Pulsa «Actualizar».', []);
      } finally {
        busy = false;
        view.busy(false);
      }
    },
  };
}
