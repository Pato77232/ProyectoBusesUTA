const validateBusAgenda = require('./validate-bus-agenda');
const { parseScheduledInstant } = require('../value-objects/scheduled-instant');
const { createDayCyclePeriod, toScheduledIso } = require('../value-objects/day-cycle-period');
const {
  requireObject,
  requireText,
  readList,
  requireUnique,
  assertContext,
} = require('../value-objects/programming-input');
const { RouteProgrammingConflictError } = require('../errors/route-programming-errors');

const serviceKey = (service) => JSON.stringify([service.frequencyId, service.departureAt]);

function assertInsidePeriod(start, end, period) {
  if (start < period.startMs || start >= period.endMs || end > period.endMs) {
    throw new RouteProgrammingConflictError(
      'ROUTE_PATTERN_OUTSIDE_PERIOD',
      'El patrón corta una actividad, preparación o bloqueo.',
    );
  }
}

function readRequired(value, period) {
  requireObject(value, 'Servicio requerido');
  const departureMs = parseScheduledInstant(value.departureAt, 'departureAt requerido');
  assertInsidePeriod(departureMs, departureMs, period);
  return Object.freeze({
    id: requireText(value.id, 'id requerido'),
    frequencyId: requireText(value.frequencyId, 'frequencyId requerido'),
    departureAt: toScheduledIso(departureMs),
  });
}

function assertAgendaInsidePeriod(agenda, period) {
  for (const activity of agenda.activities) {
    assertInsidePeriod(Date.parse(activity.departureAt), Date.parse(activity.readyAt), period);
  }
  for (const block of agenda.blocks) {
    assertInsidePeriod(Date.parse(block.startAt), Date.parse(block.endAt), period);
  }
}

function assertRepeatable(agenda, period) {
  if (!agenda.activities.length) return;
  const shift = (value) => toScheduledIso(Date.parse(value) + period.durationMs);
  const last = agenda.activities[agenda.activities.length - 1];
  validateBusAgenda({
    ...agenda,
    initialAvailability: { availableAt: last.readyAt, locationKey: last.destinationKey },
    activities: agenda.activities.map((activity) => ({
      ...activity,
      departureAt: shift(activity.departureAt),
      arrivalAt: shift(activity.arrivalAt),
    })),
    blocks: agenda.blocks.map((block) => ({
      ...block,
      startAt: shift(block.startAt),
      endAt: shift(block.endAt),
    })),
  });
}

function assertCoverage(agendas, requiredServices) {
  const required = new Map(requiredServices.map((service) => [serviceKey(service), service]));
  const assigned = new Set();
  for (const service of agendas
    .flatMap(({ activities }) => activities)
    .filter(({ kind }) => kind === 'SERVICE')) {
    const key = serviceKey(service);
    if (!required.has(key) || assigned.has(key)) {
      throw new RouteProgrammingConflictError(
        'ROUTE_PATTERN_COVERAGE_CONFLICT',
        'Existe un servicio no requerido o asignado más de una vez.',
      );
    }
    assigned.add(key);
  }
  if (assigned.size !== required.size) {
    throw new RouteProgrammingConflictError(
      'ROUTE_PATTERN_COVERAGE_CONFLICT',
      'Faltan servicios requeridos por asignar.',
    );
  }
}

function validateRoutePattern(input) {
  requireObject(input, 'Patrón');
  const cooperativeId = requireText(input.cooperativeId, 'cooperativeId');
  const busGroupId = requireText(input.busGroupId, 'busGroupId');
  const context = { cooperativeId, busGroupId };
  const period = createDayCyclePeriod(input);
  const requiredServices = readList(input.requiredServices, 'requiredServices', (value) =>
    readRequired(value, period),
  );
  requireUnique(
    requiredServices.map(({ id }) => id),
    'requiredServices',
  );
  requireUnique(requiredServices.map(serviceKey), 'Salidas requeridas');
  const agendas = readList(input.agendas, 'agendas', (value) => {
    assertContext(value, context);
    const agenda = validateBusAgenda(value);
    assertAgendaInsidePeriod(agenda, period);
    assertRepeatable(agenda, period);
    return Object.freeze({ ...agenda, busGroupId });
  });
  requireUnique(
    agendas.map(({ busId }) => busId),
    'Buses del patrón',
  );
  requireUnique(
    agendas.flatMap(({ activities }) => activities.map(({ id }) => id)),
    'Actividades del patrón',
  );
  assertCoverage(agendas, requiredServices);
  return Object.freeze({
    ...context,
    cycleStartDate: period.cycleStartDate,
    cycleLengthDays: period.cycleLengthDays,
    startAt: period.startAt,
    endExclusive: period.endExclusive,
    requiredServices: Object.freeze(requiredServices),
    agendas: Object.freeze(agendas),
  });
}

module.exports = validateRoutePattern;
