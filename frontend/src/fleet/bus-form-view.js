// FLEET-05: presenta el formulario. Los datos llegan por parámetro; bus-controller.js los pide a la API.
import {
  buildBusData,
  formatPhotoSize,
  seatsByDeck,
  validateBusFields,
  validatePhotos,
} from './bus-form.js';

const FIELD_NAMES = [
  'plate',
  'vin',
  'unitNumber',
  'bodyworkBrand',
  'color',
  'busGroupId',
  'seatLayoutId',
];
const PHOTOS_FIELD = 'photos';
const DISABLED_SEATS = { name: 'disabledSeatKeys', deckClass: 'seat-deck' };
const VIP_SEATS = { name: 'vipSeatKeys', deckClass: 'vip-deck' };

function addOptions(select, items, describe) {
  for (const item of items) select.add(new Option(describe(item), item.id));
}

function showStatus(status, text, tone) {
  status.textContent = text;
  status.hidden = false;
  status.dataset.tone = tone;
}

function setFieldError(form, name, message) {
  const control = form.elements[name];
  const error = form.querySelector(`#${name}-error`);
  error.textContent = message ?? '';
  error.hidden = !message;
  if (message) control.setAttribute('aria-invalid', 'true');
  else control.removeAttribute('aria-invalid');
}

function renderSeats(container, layout, { name, deckClass }) {
  container.replaceChildren();
  for (const deck of layout ? seatsByDeck(layout) : []) {
    const group = document.createElement('fieldset');
    group.className = deckClass;
    const legend = document.createElement('legend');
    legend.textContent = `Piso ${deck.number}`;
    const seats = document.createElement('div');
    seats.className = 'seat-options';
    for (const seat of deck.seats) {
      const label = document.createElement('label');
      label.className = 'seat-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = name;
      input.value = seat.key;
      label.append(input, ` ${seat.label}`);
      seats.append(label);
    }
    group.append(legend, seats);
    container.append(group);
  }
}

function renderPhotos(list, files) {
  list.replaceChildren(
    ...files.map((file) => {
      const item = document.createElement('li');
      item.textContent = `${file.name} · ${formatPhotoSize(file.size)}`;
      return item;
    }),
  );
}

function readValues(form) {
  return Object.fromEntries(FIELD_NAMES.map((name) => [name, form.elements[name].value]));
}

function selectedSeats(form, name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

export function mountBusForm(form, { busGroups, seatLayouts, onValid }) {
  const fields = form.querySelector('#bus-fields');
  const status = form.querySelector('#bus-form-status');
  const seatSection = form.querySelector('#seat-section');
  const seatDecks = form.querySelector('#seat-decks');
  const vipDecks = form.querySelector('#vip-decks');
  const seatNotice = form.querySelector('#seat-notice');
  const photoList = form.querySelector('#photo-list');
  const findLayout = (id) => seatLayouts.find((layout) => layout.id === id);

  if (busGroups.length === 0) {
    showStatus(
      status,
      'Tu cooperativa aún no tiene grupos de buses. Necesitas uno para registrar un bus.',
      'error',
    );
    return;
  }
  addOptions(form.elements.busGroupId, busGroups, (group) => group.name);
  addOptions(
    form.elements.seatLayoutId,
    seatLayouts,
    (layout) => `${layout.name} · ${layout.capacity} asientos`,
  );
  fields.disabled = false;
  status.hidden = true;

  form.elements.seatLayoutId.addEventListener('change', (event) => {
    const hadSelection =
      selectedSeats(form, DISABLED_SEATS.name).length + selectedSeats(form, VIP_SEATS.name).length >
      0;
    const layout = findLayout(event.target.value);
    renderSeats(seatDecks, layout, DISABLED_SEATS);
    renderSeats(vipDecks, layout, VIP_SEATS);
    seatSection.hidden = !layout;
    seatNotice.hidden = !hadSelection;
  });

  form.elements[PHOTOS_FIELD].addEventListener('change', (event) => {
    const files = [...event.target.files];
    renderPhotos(photoList, files);
    setFieldError(form, PHOTOS_FIELD, files.length ? validatePhotos(files) : null);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readValues(form);
    const files = [...form.elements[PHOTOS_FIELD].files];
    const errors = { ...validateBusFields(values) };
    const photoError = validatePhotos(files);
    if (photoError) errors[PHOTOS_FIELD] = photoError;
    for (const name of [...FIELD_NAMES, PHOTOS_FIELD]) setFieldError(form, name, errors[name]);

    if (Object.keys(errors).length > 0) {
      showStatus(status, 'Revisa los campos señalados.', 'error');
      status.focus();
      return;
    }
    status.hidden = true;
    const layout = findLayout(values.seatLayoutId);
    onValid(
      buildBusData(
        values,
        layout,
        selectedSeats(form, DISABLED_SEATS.name),
        selectedSeats(form, VIP_SEATS.name),
      ),
      files,
    );
  });
}

export function showFormStatus(form, text, tone) {
  const status = form.querySelector('#bus-form-status');
  showStatus(status, text, tone);
  status.focus();
}

// Adaptador para bus-controller.js; un estado final bloquea el formulario para no reenviar.
export function createBusFormView(form) {
  const fields = form.querySelector('#bus-fields');
  const submitButton = fields.querySelector('button[type="submit"]');
  const submitLabel = submitButton.textContent;
  const loginLink = form.querySelector('#login-link');
  const newBus = form.querySelector('#new-bus');
  let locked = false;

  function lock(text, tone) {
    locked = true;
    fields.disabled = true;
    showFormStatus(form, text, tone);
  }

  return {
    mount: (options) => mountBusForm(form, options),
    status: (text, tone) => showFormStatus(form, text, tone),
    busy(active) {
      submitButton.textContent = active ? 'Registrando…' : submitLabel;
      fields.disabled = active || locked;
    },
    replaceGroups(busGroups) {
      const select = form.elements.busGroupId;
      [...select.options].slice(1).forEach((option) => option.remove());
      addOptions(select, busGroups, (group) => group.name);
    },
    registered(bus) {
      lock(
        `Bus ${bus.plate} registrado: unidad ${bus.unitNumber}, ${bus.capacity} asientos ofrecidos.`,
        'success',
      );
      newBus.hidden = false;
    },
    signedOut(text) {
      lock(text, 'error');
      loginLink.hidden = false;
    },
    blocked: (text) => lock(text, 'error'),
  };
}
