import { createApiClient } from '../api/api-client.js';
import { createSearchController } from './search-controller.js';
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
const controller = createSearchController({
  client: createApiClient(),
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
        const item = node('li', ''),
          card = node('article', '');
        card.className = 'form-card';
        card.append(
          node('h2', `${trip.origin} → ${trip.destination}`),
          node('p', trip.cooperativeName),
          node(
            'p',
            `Embarque: ${time.format(new Date(trip.boardingAt))}. Llegada: ${time.format(new Date(trip.arrivalAt))}.`,
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
        item.append(card);
        list.append(item);
      }
      if (mode !== 'loading') status.focus();
    },
  },
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  controller.search(Object.fromEntries(new FormData(form)));
});
