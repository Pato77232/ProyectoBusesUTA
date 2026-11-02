const { BusAgendaValidationError, BusAgendaConflictError } = require('../errors/bus-agenda-errors');
const { parseScheduledInstant, calculateReadyAt } = require('../value-objects/scheduled-instant');

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BusAgendaValidationError(`${field} debe ser un objeto.`);
  }
  return value;
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BusAgendaValidationError(`${field} debe ser texto no vacío.`);
  }
  return value.trim();
}

function readIdentity(value, context) {
  requireObject(value, 'Actividad o bloqueo');
  if (value.busId !== context.busId || value.cooperativeId !== context.cooperativeId) {
    throw new BusAgendaValidationError('La actividad o bloqueo no pertenece al bus y cooperativa.');
  }
  return requireText(value.id, 'id');
}

function readActivity(value, context) {
  const id = readIdentity(value, context);
  if (!['SERVICE', 'TRANSFER'].includes(value.kind)) {
    throw new BusAgendaValidationError('La actividad debe ser SERVICE o TRANSFER.');
  }
  const departureAt = parseScheduledInstant(value.departureAt, 'departureAt');
  const arrivalAt = parseScheduledInstant(value.arrivalAt, 'arrivalAt');
  if (arrivalAt <= departureAt) {
    throw new BusAgendaValidationError('La llegada debe ser posterior a la salida.');
  }
  return {
    id,
    busId: context.busId,
    cooperativeId: context.cooperativeId,
    kind: value.kind,
    frequencyId: value.kind === 'SERVICE' ? requireText(value.frequencyId, 'frequencyId') : null,
    originKey: requireText(value.originKey, 'originKey').normalize('NFC'),
    destinationKey: requireText(value.destinationKey, 'destinationKey').normalize('NFC'),
    departureAt,
    arrivalAt,
    preparationMinutes: value.preparationMinutes,
    readyAt: calculateReadyAt(arrivalAt, value.preparationMinutes),
  };
}

function readBlock(value, context) {
  const id = readIdentity(value, context);
  if (!['REST', 'MAINTENANCE'].includes(value.kind)) {
    throw new BusAgendaValidationError('El bloqueo debe ser REST o MAINTENANCE.');
  }
  const startAt = parseScheduledInstant(value.startAt, 'startAt');
  const endAt = parseScheduledInstant(value.endAt, 'endAt');
  if (endAt <= startAt) {
    throw new BusAgendaValidationError('El fin del bloqueo debe ser posterior al inicio.');
  }
  return {
    id,
    busId: context.busId,
    cooperativeId: context.cooperativeId,
    kind: value.kind,
    startAt,
    endAt,
  };
}

function readList(values, context, reader) {
  if (!Array.isArray(values)) {
    throw new BusAgendaValidationError('activities y blocks deben ser listas explícitas.');
  }
  const result = Array.from(values, (value) => reader(value, context));
  if (new Set(result.map(({ id }) => id)).size !== result.length) {
    throw new BusAgendaValidationError('La lista contiene identificadores repetidos.');
  }
  return result;
}

function assertContinuation(activity, previous) {
  if (activity.departureAt < previous.readyAt) {
    throw new BusAgendaConflictError(
      'BUS_AGENDA_TIME_CONFLICT',
      'El bus no está disponible o no ha terminado su preparación.',
      activity.id,
      previous.id,
    );
  }
  if (activity.originKey !== previous.destinationKey) {
    throw new BusAgendaConflictError(
      'BUS_AGENDA_LOCATION_CONFLICT',
      'El bus requiere un traslado explícito hasta el siguiente origen.',
      activity.id,
      previous.id,
    );
  }
}

function assertNotBlocked(activity, blocks) {
  const block = blocks.find(
    ({ startAt, endAt }) => activity.departureAt < endAt && startAt < activity.readyAt,
  );
  if (block) {
    throw new BusAgendaConflictError(
      'BUS_AGENDA_BLOCKED',
      'El servicio, traslado o preparación coincide con descanso o mantenimiento.',
      activity.id,
      block.id,
    );
  }
}

function freezeActivity(activity) {
  return Object.freeze({
    ...activity,
    departureAt: new Date(activity.departureAt).toISOString(),
    arrivalAt: new Date(activity.arrivalAt).toISOString(),
    readyAt: new Date(activity.readyAt).toISOString(),
  });
}

function validateBusAgenda(input) {
  requireObject(input, 'Agenda');
  const busId = requireText(input.busId, 'busId');
  const cooperativeId = requireText(input.cooperativeId, 'cooperativeId');
  const initial = requireObject(input.initialAvailability, 'initialAvailability');
  const availableAt = parseScheduledInstant(initial.availableAt, 'availableAt');
  const locationKey = requireText(initial.locationKey, 'locationKey').normalize('NFC');
  const context = { busId, cooperativeId };
  const activities = readList(input.activities, context, readActivity).sort(
    (left, right) => left.departureAt - right.departureAt || left.id.localeCompare(right.id),
  );
  const blocks = readList(input.blocks, context, readBlock);
  let previous = { id: null, readyAt: availableAt, destinationKey: locationKey };
  for (const activity of activities) {
    assertContinuation(activity, previous);
    assertNotBlocked(activity, blocks);
    previous = activity;
  }
  return Object.freeze({
    ...context,
    initialAvailability: Object.freeze({
      availableAt: new Date(availableAt).toISOString(),
      locationKey,
    }),
    activities: Object.freeze(activities.map(freezeActivity)),
    blocks: Object.freeze(
      blocks.map((block) =>
        Object.freeze({
          ...block,
          startAt: new Date(block.startAt).toISOString(),
          endAt: new Date(block.endAt).toISOString(),
        }),
      ),
    ),
  });
}

module.exports = validateBusAgenda;
