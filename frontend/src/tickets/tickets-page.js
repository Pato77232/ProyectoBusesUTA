import { createApiClient } from '../api/api-client.js';
import { createTicketsController } from './tickets-controller.js';

const $ = (selector) => document.querySelector(selector);
const status = $('#tickets-status');
const login = $('#tickets-login');
const toolbar = $('#tickets-toolbar');
const list = $('#sold-bookings');
const moreRow = $('#sold-more-row');
const more = $('#sold-more');
const sheetSection = $('#tickets-sheet');

const ZONE = 'America/Guayaquil';
const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const date = new Intl.DateTimeFormat('es-EC', { timeZone: ZONE, dateStyle: 'full' });
const hour = new Intl.DateTimeFormat('es-EC', { timeZone: ZONE, timeStyle: 'short' });
const dateTime = new Intl.DateTimeFormat('es-EC', {
  timeZone: ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

function node(tag, content, className) {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = content;
  if (className) element.className = className;
  return element;
}

function detail(term, value) {
  const wrapper = node('div');
  wrapper.append(node('dt', term), node('dd', value));
  return wrapper;
}

/** El SVG se muestra como imagen: un navegador no ejecuta scripts dentro de un <img>. */
function qrImage(ticket) {
  const image = node('img', undefined, 'ticket-qr');
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ticket.qrSvg);
  image.alt = `Código QR del boleto ${ticket.code}`;
  image.width = 180;
  image.height = 180;
  return image;
}

function ticketCard(sheet, ticket, index) {
  const { origin, destination } = sheet.trip;
  const card = node('article', undefined, 'ticket-card');
  card.setAttribute('aria-labelledby', `ticket-${index}-title`);
  const header = node('header', undefined, 'ticket-header');
  const title = node('h2', `${origin.locationKey} → ${destination.locationKey}`);
  title.id = `ticket-${index}-title`;
  header.append(
    node('p', `Boleto ${index + 1} de ${sheet.tickets.length}`, 'ticket-kicker'),
    title,
  );
  const body = node('div', undefined, 'ticket-body');
  const data = node('dl', undefined, 'ticket-data');
  data.append(
    detail('Fecha de viaje', date.format(new Date(origin.departureAt))),
    detail('Salida', `${hour.format(new Date(origin.departureAt))} · ${origin.locationKey}`),
    detail(
      'Llegada estimada',
      `${hour.format(new Date(destination.arrivalAt))} · ${destination.locationKey}`,
    ),
    detail('Pasajero', ticket.passenger.fullName),
    detail('Cédula', ticket.passenger.identificationNumber),
    detail('Asiento', `Pasajero ${index + 1} de la compra`),
    detail('Valor', money.format(ticket.totalPriceCents / 100)),
    detail('Emitido', dateTime.format(new Date(ticket.issuedAt))),
  );
  const qr = node('figure', undefined, 'ticket-qr-box');
  qr.append(qrImage(ticket), node('figcaption', ticket.code, 'ticket-code'));
  body.append(data, qr);
  card.append(header, body, node('p', `Reserva ${sheet.bookingId}`, 'ticket-reference'));
  return card;
}

function soldItem(booking) {
  const item = node('li');
  const card = node('article', undefined, 'form-card');
  card.append(
    node('h2', `Compra aprobada el ${dateTime.format(new Date(booking.soldAt))}`),
    node('p', `Total ${money.format(booking.totalPriceCents / 100)} · Reserva ${booking.bookingId}`),
  );
  const link = node('a', 'Ver boletos', 'btn btn-primary');
  link.href = 'boletos.html?' + new URLSearchParams({ reserva: booking.bookingId });
  card.append(link);
  item.append(card);
  return item;
}

let nextCursor = null;

const controller = createTicketsController({
  client: createApiClient(),
  view: {
    busy(value) {
      more.disabled = value;
      list.setAttribute('aria-busy', String(value));
    },
    show(mode, message, data) {
      status.textContent = message;
      status.dataset.mode = mode;
      login.hidden = mode !== 'auth';
      toolbar.hidden = mode !== 'ready';
      if (mode === 'loading') return;
      sheetSection.hidden = mode !== 'ready';
      sheetSection.replaceChildren();
      if (mode === 'ready')
        sheetSection.append(...data.sheet.tickets.map((t, i) => ticketCard(data.sheet, t, i)));
      if (mode === 'list' || mode === 'empty') {
        if (data.bookings) list.append(...data.bookings.map(soldItem));
        nextCursor = data.nextCursor ?? null;
      } else nextCursor = null;
      moreRow.hidden = !nextCursor;
      status.focus();
    },
  },
});

const bookingId = new URLSearchParams(window.location.search).get('reserva');
$('#tickets-print').addEventListener('click', () => window.print());
more.addEventListener('click', () => controller.listSold(nextCursor));
if (bookingId === null) controller.listSold();
else controller.showSheet(bookingId);
