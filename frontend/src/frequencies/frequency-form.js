// Ayudas del formulario: el backend conserva la autoridad sobre las reglas.
const MAX_PRICE_CENTS = 9_999_999_999;
const FIELDS = [
  'origin',
  'destination',
  'departure_time',
  'ant_resolution_number',
  'status',
];
const keyOf = (value) => value.trim().toLowerCase();

export function createDraft() {
  return {
    origin: '',
    destination: '',
    departure_time: '',
    ant_resolution_number: '',
    status: 'ACTIVE',
    stops: [],
    prices: {},
    nextStopId: 1,
  };
}

export function segments(draft) {
  const points = [
    { id: 'origin', value: draft.origin },
    ...draft.stops,
    { id: 'destination', value: draft.destination },
  ];
  return points.slice(0, -1).map((from, index) => {
    const to = points[index + 1];
    return {
      key: JSON.stringify([from.id, keyOf(from.value), to.id, keyOf(to.value)]),
      from: from.value.trim(),
      to: to.value.trim(),
    };
  });
}

function reconcile(draft) {
  const prices = Object.fromEntries(
    segments(draft).map(({ key }) => [key, draft.prices[key] ?? '']),
  );
  return { ...draft, prices };
}

export function editField(draft, field, value) {
  if (!FIELDS.includes(field))
    throw new TypeError('Campo de frecuencia desconocido.');
  return reconcile({ ...draft, [field]: value });
}

export function addStop(draft) {
  return reconcile({
    ...draft,
    nextStopId: draft.nextStopId + 1,
    stops: [...draft.stops, { id: `stop-${draft.nextStopId}`, value: '' }],
  });
}

export function editStop(draft, id, value) {
  return reconcile({
    ...draft,
    stops: draft.stops.map((stop) =>
      stop.id === id ? { ...stop, value } : stop,
    ),
  });
}

export function removeStop(draft, id) {
  return reconcile({
    ...draft,
    stops: draft.stops.filter((stop) => stop.id !== id),
  });
}

export function moveStop(draft, id, direction) {
  const index = draft.stops.findIndex((stop) => stop.id === id);
  const target = index + direction;
  if (
    ![-1, 1].includes(direction) ||
    index < 0 ||
    target < 0 ||
    target >= draft.stops.length
  )
    return draft;
  const stops = [...draft.stops];
  [stops[index], stops[target]] = [stops[target], stops[index]];
  return reconcile({ ...draft, stops });
}

export function editPrice(draft, key, value) {
  if (!segments(draft).some((segment) => segment.key === key))
    throw new TypeError('Tramo desconocido.');
  return { ...draft, prices: { ...draft.prices, [key]: value } };
}

function parsePrice(value) {
  if (typeof value !== 'string' || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))
    return null;
  const [whole, decimal = ''] = value.trim().replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_PRICE_CENTS
    ? cents / 100
    : null;
}

export function reviewDraft(draft) {
  const errors = {};
  if (!draft.origin.trim()) errors.origin = 'Introduce el origen.';
  if (!draft.destination.trim()) errors.destination = 'Introduce el destino.';
  else if (keyOf(draft.origin) === keyOf(draft.destination))
    errors.destination = 'El destino debe ser diferente del origen.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.departure_time))
    errors.departure_time = 'Introduce una hora válida de 00:00 a 23:59.';
  if (!draft.ant_resolution_number.trim())
    errors.ant_resolution_number = 'Introduce el número de resolución ANT.';
  if (!['ACTIVE', 'INACTIVE'].includes(draft.status))
    errors.status = 'Selecciona un estado válido.';
  const seen = new Set([keyOf(draft.origin), keyOf(draft.destination)]);
  for (const stop of draft.stops) {
    const key = keyOf(stop.value);
    if (!key) errors[stop.id] = 'Introduce el nombre de la parada.';
    else if (seen.has(key))
      errors[stop.id] = 'La parada no puede repetir otro punto del recorrido.';
    seen.add(key);
  }
  const amounts = segments(draft).map(({ key }, index) => {
    const amount = parsePrice(draft.prices[key]);
    if (amount === null)
      errors[`price-${index}`] =
        'Introduce un valor USD mayor que cero, hasta 99.999.999,99 y con hasta dos decimales.';
    return amount;
  });
  return {
    errors,
    data: Object.keys(errors).length
      ? null
      : {
          origin: draft.origin.trim(),
          destination: draft.destination.trim(),
          departure_time: draft.departure_time,
          ant_resolution_number: draft.ant_resolution_number.trim(),
          status: draft.status,
          stops: draft.stops.map((stop) => stop.value.trim()),
          segment_prices: amounts,
        },
  };
}
