import {
  createDraft,
  segments,
  editField,
  addStop,
  editStop,
  moveStop,
  removeStop,
  editPrice,
  reviewDraft,
} from './frequency-form.js';

export function mountFrequencyForm(form) {
  const document = form.ownerDocument;
  let draft = createDraft();
  const find = (id) => form.querySelector(`#${id}`);
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function field(id, text, value, hint) {
    const wrap = element('div');
    const label = element('label', text, 'form-label');
    label.htmlFor = id;
    const input = element('input', null, 'form-control');
    input.id = id;
    input.name = id;
    input.value = value;
    input.required = true;
    input.setAttribute('aria-describedby', `${hint} ${id}-error`);
    const error = element('p', null, 'field-error');
    error.id = `${id}-error`;
    error.hidden = true;
    wrap.append(label, input, error);
    return { wrap, input };
  }
  function clearErrors() {
    form
      .querySelectorAll('[aria-invalid]')
      .forEach((node) => node.removeAttribute('aria-invalid'));
    form.querySelectorAll('.field-error').forEach((node) => {
      node.hidden = true;
      node.textContent = '';
    });
    find('review-status').textContent =
      'Los datos han cambiado. Revísalos de nuevo; todavía no se guardan.';
  }
  function renderPrices() {
    const list = find('price-list');
    list.replaceChildren();
    segments(draft).forEach((segment, index) => {
      const { wrap, input } = field(
        `price-${index}`,
        `${segment.from || 'Origen pendiente'} → ${segment.to || 'Destino pendiente'} (USD)`,
        draft.prices[segment.key] ?? '',
        'prices-hint',
      );
      wrap.className = 'frequency-price';
      input.inputMode = 'decimal';
      input.addEventListener('input', () => {
        draft = editPrice(draft, segment.key, input.value);
        clearErrors();
      });
      list.append(wrap);
    });
  }
  function renderStops() {
    const list = find('stop-list');
    list.replaceChildren();
    draft.stops.forEach((stop, index) => {
      const item = element('li', null, 'frequency-stop');
      const { wrap, input } = field(
        stop.id,
        `Parada ${index + 1}`,
        stop.value,
        'stops-hint',
      );
      input.addEventListener('input', () => {
        draft = editStop(draft, stop.id, input.value);
        clearErrors();
        renderPrices();
      });
      const actions = element('div', null, 'frequency-stop-actions');
      for (const [text, direction] of [
        ['Subir', -1],
        ['Bajar', 1],
        ['Quitar', 0],
      ]) {
        const button = element('button', text, 'btn btn-outline-dark');
        button.type = 'button';
        button.setAttribute('aria-label', `${text} parada ${index + 1}`);
        button.disabled =
          (direction === -1 && index === 0) ||
          (direction === 1 && index === draft.stops.length - 1);
        button.addEventListener('click', () => {
          draft = direction
            ? moveStop(draft, stop.id, direction)
            : removeStop(draft, stop.id);
          clearErrors();
          renderStops();
          renderPrices();
          const focusId = direction
            ? stop.id
            : draft.stops[Math.min(index, draft.stops.length - 1)]?.id;
          (focusId ? find(focusId) : find('add-stop')).focus();
          find('stop-status').textContent = direction
            ? `Parada movida a la posición ${draft.stops.findIndex((row) => row.id === stop.id) + 1}. Revisa los valores de los tramos afectados.`
            : 'Parada eliminada. Revisa los valores de los tramos afectados.';
        });
        actions.append(button);
      }
      item.append(wrap, actions);
      list.append(item);
    });
  }
  for (const name of [
    'origin',
    'destination',
    'departure_time',
    'ant_resolution_number',
    'status',
  ]) {
    find(name).addEventListener(name === 'status' ? 'change' : 'input', () => {
      draft = editField(draft, name, find(name).value);
      clearErrors();
      if (name === 'origin' || name === 'destination') renderPrices();
    });
  }
  find('add-stop').addEventListener('click', () => {
    draft = addStop(draft);
    clearErrors();
    renderStops();
    renderPrices();
    find(draft.stops.at(-1).id).focus();
    find('stop-status').textContent =
      'Parada añadida. Introduce su nombre y revisa los tramos afectados.';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors();
    const { errors } = reviewDraft(draft);
    for (const [id, message] of Object.entries(errors)) {
      find(id).setAttribute('aria-invalid', 'true');
      const error = find(`${id}-error`);
      error.textContent = message;
      error.hidden = false;
    }
    const first = Object.keys(errors)[0];
    find('review-status').textContent = first
      ? `Revisa los campos indicados (${Object.keys(errors).length}). No se ha guardado ninguna frecuencia desde esta pantalla.`
      : 'Datos revisados. Esta pantalla todavía no guarda frecuencias; la conexión se incorporará después.';
    (first ? find(first) : find('review-status')).focus();
  });
  renderStops();
  renderPrices();
  find('frequency-fields').disabled = false;
}
