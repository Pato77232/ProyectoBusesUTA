const TicketError = require('./ticket-error');

// Ecuador continental no tiene horario de verano: el desfase es fijo.
const ECUADOR_OFFSET_MINUTES = -5 * 60;
const MS_PER_MINUTE = 60 * 1000;
const MICROS_PER_CENT = 10000;
const LANGUAGE = 'es';
const ID_PART = /^[A-Za-z0-9._-]+$/;

function localName(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TicketError();
  return { defaultValue: { language: LANGUAGE, value } };
}

/** ISO 8601 con el desfase de Ecuador, como lo pide `ticketLeg`. */
function ecuadorDateTime(instant) {
  const time = Date.parse(instant);
  if (!Number.isFinite(time)) throw new TicketError();
  const local = new Date(time + ECUADOR_OFFSET_MINUTES * MS_PER_MINUTE);
  const offsetHours = String(Math.abs(ECUADOR_OFFSET_MINUTES / 60)).padStart(2, '0');
  const sign = ECUADOR_OFFSET_MINUTES < 0 ? '-' : '+';
  return local.toISOString().slice(0, 19) + `${sign}${offsetHours}:00`;
}

function idPart(value) {
  if (typeof value !== 'string' || !ID_PART.test(value)) throw new TicketError();
  return value;
}

/**
 * Arma el `transitObject` de Google Wallet para un boleto ya emitido (BOLETOS-03).
 * Reutiliza el código y el QR de BOLETOS-01; nunca incluye la cédula. El nombre del
 * pasajero queda fuera hasta que se decida la pregunta abierta de la spec.
 */
function googleWalletTransitObject({ issuerId, classSuffix, sheet, ticket }) {
  const issuer = idPart(issuerId);
  const trip = sheet?.trip;
  if (!trip?.origin || !trip?.destination || !ticket) throw new TicketError();
  if (!Number.isSafeInteger(ticket.totalPriceCents) || ticket.totalPriceCents < 0)
    throw new TicketError();
  return Object.freeze({
    id: `${issuer}.${idPart(ticket.ticketId)}`,
    classId: `${issuer}.${idPart(classSuffix)}`,
    state: 'ACTIVE',
    tripType: 'ONE_WAY',
    ticketLeg: {
      originName: localName(trip.origin.locationKey),
      destinationName: localName(trip.destination.locationKey),
      departureDateTime: ecuadorDateTime(trip.origin.departureAt),
      arrivalDateTime: ecuadorDateTime(trip.destination.arrivalAt),
    },
    ticketNumber: ticket.code,
    barcode: { type: 'QR_CODE', value: ticket.qrPayload, alternateText: ticket.code },
    purchaseDetails: {
      ticketCost: {
        faceValue: {
          currencyCode: sheet.currency,
          micros: ticket.totalPriceCents * MICROS_PER_CENT,
        },
      },
    },
  });
}

module.exports = { googleWalletTransitObject, ecuadorDateTime };
