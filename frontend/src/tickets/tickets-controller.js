const CODE = /^[A-Z2-7]{26}$/;
const CEDULA = /^\d{10}$/;
const MAX_ID_LENGTH = 200;
const PAGE_SIZE = 20;

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const instant = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const cents = (value) => Number.isSafeInteger(value) && value >= 0;

export function validBookingId(value) {
  return text(value) && value.length <= MAX_ID_LENGTH && !/[/\\#?\u0000-\u001f]/u.test(value);
}

function validTicket(ticket) {
  return (
    !!ticket &&
    text(ticket.ticketId) &&
    typeof ticket.code === 'string' &&
    CODE.test(ticket.code) &&
    ticket.qrPayload === `TRANSVIAJE:TICKET:${ticket.code}` &&
    typeof ticket.qrSvg === 'string' &&
    /^<svg[\s>]/.test(ticket.qrSvg) &&
    instant(ticket.issuedAt) &&
    text(ticket.seatId) &&
    text(ticket.passenger?.fullName) &&
    CEDULA.test(ticket.passenger?.identificationNumber ?? '') &&
    cents(ticket.totalPriceCents)
  );
}

/** Rechaza respuestas incompletas: un boleto a medias no debe parecer válido. */
export function validSheet(sheet, bookingId) {
  const trip = sheet?.trip;
  return (
    !!sheet &&
    sheet.bookingId === bookingId &&
    sheet.currency === 'USD' &&
    cents(sheet.totalPriceCents) &&
    text(trip?.origin?.locationKey) &&
    text(trip?.destination?.locationKey) &&
    instant(trip?.origin?.departureAt) &&
    instant(trip?.destination?.arrivalAt) &&
    Array.isArray(sheet.tickets) &&
    sheet.tickets.length > 0 &&
    sheet.tickets.every(validTicket) &&
    new Set(sheet.tickets.map((t) => t.code)).size === sheet.tickets.length
  );
}

function validSoldBooking(item) {
  return (
    !!item &&
    validBookingId(item.bookingId) &&
    instant(item.soldAt) &&
    cents(item.totalPriceCents) &&
    item.currency === 'USD'
  );
}

function failureMode(error) {
  if (error?.status === 401) return 'auth';
  if (error?.status === 403) return 'forbidden';
  return 'error';
}

const MESSAGES = Object.freeze({
  auth: 'Tu sesión no está activa. Inicia sesión como cliente para ver tus boletos.',
  forbidden: 'Los boletos solo están disponibles para la cuenta de cliente que compró.',
  error: 'No se pudieron cargar los boletos. Intenta de nuevo en unos minutos.',
});

export function createTicketsController({ client, view }) {
  let busy = false;

  async function run(work) {
    if (busy) return;
    busy = true;
    view.busy(true);
    try {
      await work();
    } finally {
      busy = false;
      view.busy(false);
    }
  }

  return {
    showSheet(bookingId) {
      return run(async () => {
        if (!validBookingId(bookingId)) {
          view.show('empty', 'La reserva indicada no es válida.', {});
          return;
        }
        view.show('loading', 'Cargando tus boletos…', {});
        try {
          const sheet = await client.request(
            '/api/v1/tickets/bookings/' + encodeURIComponent(bookingId),
          );
          if (!validSheet(sheet, bookingId)) throw new Error('Respuesta inválida');
          const count = sheet.tickets.length;
          view.show(
            'ready',
            count === 1 ? 'Tu boleto está listo.' : `Tus ${count} boletos están listos.`,
            { sheet },
          );
        } catch (error) {
          if (error?.status === 404)
            view.show(
              'empty',
              'No hay boletos para esta reserva. Se emiten cuando el pago queda aprobado.',
              {},
            );
          else view.show(failureMode(error), MESSAGES[failureMode(error)], {});
        }
      });
    },

    listSold(cursor) {
      return run(async () => {
        view.show('loading', 'Buscando tus compras aprobadas…', {});
        try {
          const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
          if (cursor) query.set('cursor', cursor);
          const result = (await client.request('/api/v1/bookings?' + query))?.bookings;
          if (!Array.isArray(result?.items)) throw new Error('Respuesta inválida');
          const sold = result.items.filter((item) => item?.status === 'SOLD');
          if (!sold.every(validSoldBooking)) throw new Error('Respuesta inválida');
          const nextCursor = typeof result.nextCursor === 'string' ? result.nextCursor : null;
          view.show(
            sold.length ? 'list' : 'empty',
            sold.length
              ? 'Elige una compra para ver sus boletos.'
              : 'Todavía no tienes compras aprobadas en esta página del historial.',
            { bookings: sold, nextCursor },
          );
        } catch (error) {
          view.show(failureMode(error), MESSAGES[failureMode(error)], {});
        }
      });
    },
  };
}
