const ZONE = 'America/Guayaquil';
const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const dateTime = new Intl.DateTimeFormat('es-EC', {
  timeZone: ZONE,
  dateStyle: 'full',
  timeStyle: 'short',
});

/** Estado de la reserva que debe tener cada aviso para enviarse. */
const REQUIRED_STATUS = Object.freeze({
  TICKETS_READY: 'SOLD',
  PROOF_REJECTED: 'REJECTED',
  BOOKING_EXPIRED: 'EXPIRED',
});

function route(trip) {
  if (!trip) return null;
  return `${trip.origin.locationKey} → ${trip.destination.locationKey}, salida ${dateTime.format(
    new Date(trip.origin.departureAt),
  )} (hora de Ecuador)`;
}

function lines(...parts) {
  return parts.filter((part) => part !== null && part !== undefined).join('\n');
}

const SIGNATURE = '\nEquipo transViaje\nEste es un mensaje automático; no respondas a este correo.';

function ticketsReady(context, origin) {
  const link = `${origin}/pages/boletos.html?reserva=${encodeURIComponent(context.bookingId)}`;
  const count = context.passengers.length;
  return {
    subject: 'Tus boletos de transViaje están listos',
    text: lines(
      'Tu pago fue aprobado y tus boletos ya están emitidos.',
      '',
      route(context.trip) && `Viaje: ${route(context.trip)}`,
      `Pasajeros (${count}): ${context.passengers.map((p) => p.fullName).join(', ')}`,
      `Total pagado: ${money.format(context.totalPriceCents / 100)}`,
      `Reserva: ${context.bookingId}`,
      '',
      `Ve e imprime tus boletos aquí: ${link}`,
      'Inicia sesión con tu cuenta para ver el código QR de cada pasajero.',
      SIGNATURE,
    ),
  };
}

function proofRejected(context, payload) {
  return {
    subject: 'Tu comprobante de pago fue rechazado',
    text: lines(
      'Revisamos tu comprobante de pago y no pudimos aprobarlo.',
      '',
      `Motivo: ${payload.justification}`,
      route(context.trip) && `Viaje: ${route(context.trip)}`,
      `Reserva: ${context.bookingId}`,
      '',
      'Los asientos de esta reserva se liberaron. Si todavía quieres viajar, haz una nueva reserva.',
      SIGNATURE,
    ),
  };
}

function bookingExpired(context) {
  return {
    subject: 'Tu reserva venció',
    text: lines(
      'No recibimos el comprobante de pago dentro del plazo de tu reserva.',
      '',
      route(context.trip) && `Viaje: ${route(context.trip)}`,
      `Reserva: ${context.bookingId}`,
      '',
      'Los asientos se liberaron. Si todavía quieres viajar, haz una nueva reserva.',
      SIGNATURE,
    ),
  };
}

/** Asunto y texto plano del aviso. Sin cédulas ni códigos de boleto. */
function noticeMessage({ kind, context, payload, origin }) {
  if (kind === 'TICKETS_READY') return ticketsReady(context, origin);
  if (kind === 'PROOF_REJECTED') return proofRejected(context, payload);
  if (kind === 'BOOKING_EXPIRED') return bookingExpired(context);
  throw new TypeError('Tipo de aviso desconocido.');
}

module.exports = { REQUIRED_STATUS, noticeMessage };
