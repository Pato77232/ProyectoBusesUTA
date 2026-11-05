import { createApiClient } from '../api/api-client.js';
import { createSearchController } from './search-controller.js';
import { createUpcomingController, ecuadorDate, groupByDay, stopsText } from './upcoming.js';
const form = document.querySelector('#search-form'),
  status = document.querySelector('#search-status'),
  list = document.querySelector('#search-results');
const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const time = new Intl.DateTimeFormat('es-EC', {
  timeZone: 'America/Guayaquil',
  dateStyle: 'medium',
  timeStyle: 'short',
});
const node = (tag, text) => {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
};
// Tarjeta de un viaje; la usan los resultados y las próximas salidas (SEARCH-02).
function tripCard(trip) {
  const card = node('article', '');
  card.className = 'form-card';
  const stops = Number.isSafeInteger(trip.stopCount) ? ` · ${stopsText(trip.stopCount)}` : '';
  card.append(
    node('h3', `${trip.origin} → ${trip.destination}`),
    node('p', trip.cooperativeName + stops),
    node(
      'p',
      `Embarque: ${time.format(new Date(trip.boardingAt))} · Llegada: ${time.format(new Date(trip.arrivalAt))}`,
    ),
    node(
      'p',
      `Tarifa base: ${money.format(trip.amountCents / 100)}. El resumen aplica categoría y beneficios acreditados.`,
    ),
  );
  const link = node('a', 'Ver asientos');
  link.className = 'btn btn-primary';
  link.href =
    '/pages/reservas.html?' +
    new URLSearchParams({
      tripId: trip.tripId,
      fromPosition: trip.fromPosition,
      toPosition: trip.toPosition,
    });
  card.append(link);
  return card;
}
const client = createApiClient();
const upcomingSection = document.querySelector('#upcoming-section'),
  upcomingStatus = document.querySelector('#upcoming-status'),
  upcomingList = document.querySelector('#upcoming-list'),
  upcomingRefresh = document.querySelector('#upcoming-refresh'),
  showUpcoming = document.querySelector('#show-upcoming');
const upcoming = createUpcomingController({
  client,
  view: {
    busy(value) {
      upcomingRefresh.disabled = value;
      upcomingList.setAttribute('aria-busy', String(value));
    },
    show(mode, message, trips) {
      upcomingStatus.textContent = message;
      upcomingStatus.dataset.mode = mode;
      upcomingList.replaceChildren();
      for (const group of groupByDay(trips)) {
        const day = node('section', '');
        day.setAttribute('aria-label', group.label);
        const items = node('ul', '');
        items.className = 'list-unstyled';
        for (const trip of group.trips) {
          const item = node('li', '');
          item.append(tripCard(trip));
          items.append(item);
        }
        day.append(node('h3', group.label), items);
        day.firstChild.className = 'h5 mt-3';
        upcomingList.append(day);
      }
    },
  },
});
const controller = createSearchController({
  client,
  view: {
    busy(value) {
      form.querySelector('button').disabled = value;
      list.setAttribute('aria-busy', String(value));
    },
    show(mode, message, trips) {
      status.textContent = message;
      status.dataset.mode = mode;
      list.replaceChildren();
      for (const trip of trips) {
        const item = node('li', '');
        item.append(tripCard(trip));
        list.append(item);
      }
      if (mode !== 'loading') status.focus();
    },
  },
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  upcomingSection.hidden = true;
  showUpcoming.hidden = false;
  controller.search(Object.fromEntries(new FormData(form)));
});
showUpcoming.addEventListener('click', () => {
  list.replaceChildren();
  status.textContent = 'Elige una de las próximas salidas o busca por ciudades y fecha.';
  showUpcoming.hidden = true;
  upcomingSection.hidden = false;
  upcoming.load();
});
upcomingRefresh.addEventListener('click', () => upcoming.load());
// La fecha empieza en hoy (hora de Ecuador) y no admite días pasados.
const dateInput = form.querySelector('#date');
dateInput.value = ecuadorDate(Date.now());
dateInput.min = dateInput.value;
upcoming.load();
