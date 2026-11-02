const { RouteProgrammingValidationError } = require('../errors/route-programming-errors');
const { parseScheduledInstant } = require('./scheduled-instant');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REVISION = 2_147_483_646;

function invalid(message = 'La programación contiene campos inválidos.') {
  throw new RouteProgrammingValidationError(message);
}

function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) invalid('Identificador inválido.');
  return value.toLowerCase();
}

function fields(value, names) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !names.includes(key)) ||
    names.some((key) => !Object.hasOwn(value, key))
  )
    invalid();
}

function list(value, reader) {
  if (!Array.isArray(value)) invalid('Se requiere una lista explícita.');
  return Array.from(value, reader);
}

function text(value) {
  if (typeof value !== 'string' || !value.trim()) invalid();
  return value.trim().normalize('NFC');
}

function instant(value) {
  return new Date(parseScheduledInstant(value, 'instante')).toISOString();
}

function readPoint(value, index, all) {
  const names =
    index === 0
      ? ['position', 'departureAt']
      : index === all.length - 1
        ? ['position', 'arrivalAt']
        : ['position', 'arrivalAt', 'departureAt'];
  fields(value, names);
  if (value.position !== index) invalid('Las posiciones deben ser consecutivas desde cero.');
  return Object.fromEntries(
    names.map((name) => [name, name === 'position' ? index : instant(value[name])]),
  );
}

function activity(value) {
  const base = ['id', 'kind', 'departureAt', 'arrivalAt', 'preparationMinutes'];
  if (value?.kind === 'SERVICE') {
    fields(value, [...base, 'frequencyId', 'requiredServiceId', 'points']);
  } else if (value?.kind === 'TRANSFER') {
    fields(value, [...base, 'originKey', 'destinationKey']);
  } else invalid('Tipo de actividad inválido.');
  if (!Number.isSafeInteger(value.preparationMinutes) || value.preparationMinutes < 0)
    invalid('La preparación debe ser un entero no negativo explícito.');
  const result = {
    id: uuid(value.id),
    kind: value.kind,
    departureAt: instant(value.departureAt),
    arrivalAt: instant(value.arrivalAt),
    preparationMinutes: value.preparationMinutes,
  };
  if (value.kind === 'TRANSFER')
    return {
      ...result,
      originKey: text(value.originKey),
      destinationKey: text(value.destinationKey),
    };
  if (!Array.isArray(value.points) || value.points.length < 2)
    invalid('Se requieren todos los puntos.');
  return {
    ...result,
    frequencyId: uuid(value.frequencyId),
    requiredServiceId: uuid(value.requiredServiceId),
    points: Array.from(value.points, (point, index) => readPoint(point, index, value.points)),
  };
}

function readAgenda(value) {
  fields(value, ['busId', 'initialAvailability', 'activities', 'blocks']);
  fields(value.initialAvailability, ['availableAt', 'locationKey']);
  return {
    busId: uuid(value.busId),
    initialAvailability: {
      availableAt: instant(value.initialAvailability.availableAt),
      locationKey: text(value.initialAvailability.locationKey),
    },
    activities: list(value.activities, activity),
    blocks: list(value.blocks, (block) => {
      fields(block, ['id', 'kind', 'startAt', 'endAt', 'reason']);
      if (!['REST', 'MAINTENANCE'].includes(block.kind)) invalid('Tipo de bloqueo inválido.');
      return {
        id: uuid(block.id),
        kind: block.kind,
        startAt: instant(block.startAt),
        endAt: instant(block.endAt),
        reason: text(block.reason),
      };
    }),
  };
}

function parseProgrammingRequest({ expectedRevision, programming }) {
  if (
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 0 ||
    expectedRevision > MAX_REVISION
  )
    invalid('La revisión esperada debe ser un entero no negativo válido.');
  fields(programming, ['cycleStartDate', 'cycleLengthDays', 'requiredServices', 'agendas']);
  const requiredServices = list(programming.requiredServices, (value) => {
    fields(value, ['id', 'frequencyId', 'departureAt']);
    return {
      id: uuid(value.id),
      frequencyId: uuid(value.frequencyId),
      departureAt: instant(value.departureAt),
    };
  });
  const agendas = list(programming.agendas, readAgenda);
  if (!requiredServices.length || !agendas.length)
    invalid('La programación requiere servicios y agendas.');
  const ids = [
    ...requiredServices.map(({ id }) => id),
    ...agendas.flatMap((agenda) => [...agenda.activities, ...agenda.blocks].map(({ id }) => id)),
  ];
  if (new Set(ids).size !== ids.length)
    invalid('Las identidades de programación no se pueden repetir.');
  return {
    expectedRevision,
    programming: {
      cycleStartDate: programming.cycleStartDate,
      cycleLengthDays: programming.cycleLengthDays,
      requiredServices,
      agendas,
    },
  };
}

module.exports = { uuid, parseProgrammingRequest };
