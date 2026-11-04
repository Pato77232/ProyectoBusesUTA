const { parseProgrammingRequest } = require('../value-objects/programming-request');
const { createDayCyclePeriod, toScheduledIso } = require('../value-objects/day-cycle-period');
const { parseScheduledInstant } = require('../value-objects/scheduled-instant');
const validateRoutePattern = require('./validate-route-pattern');
const { RenewalSourceError } = require('../errors/route-renewal-errors');

const CONTINENTAL_OFFSET_MS = -5 * 60 * 60 * 1000;

function checkedPoints(activity, route) {
  if (!route || route.length !== activity.points.length) throw new RenewalSourceError();
  let previous = Date.parse(activity.departureAt);
  for (const point of activity.points) {
    const arrival = Date.parse(point.arrivalAt ?? point.departureAt);
    const departure = Date.parse(point.departureAt ?? point.arrivalAt);
    if (arrival < previous || departure < arrival || departure > Date.parse(activity.arrivalAt))
      throw new RenewalSourceError();
    previous = departure;
  }
  if (
    activity.points[0].departureAt !== activity.departureAt ||
    activity.points.at(-1).arrivalAt !== activity.arrivalAt
  )
    throw new RenewalSourceError();
}

function validateRenewalProgramming(programming, tariff, context) {
  const parsed = parseProgrammingRequest({ expectedRevision: 0, programming }).programming;
  const routes = new Map(tariff.frequencies.map((entry) => [entry.frequencyId, entry.routePoints]));
  const used = new Set(parsed.requiredServices.map((entry) => entry.frequencyId));
  if (routes.size !== used.size || [...used].some((id) => !routes.has(id)))
    throw new RenewalSourceError();
  const agendas = parsed.agendas.map((agenda) => ({
    ...agenda,
    ...context,
    activities: agenda.activities.map((activity) => {
      if (activity.kind === 'TRANSFER') return { ...activity, ...context, busId: agenda.busId };
      const required = parsed.requiredServices.find(
        (entry) => entry.id === activity.requiredServiceId,
      );
      if (
        !required ||
        required.frequencyId !== activity.frequencyId ||
        required.departureAt !== activity.departureAt
      )
        throw new RenewalSourceError();
      const route = routes.get(activity.frequencyId);
      checkedPoints(activity, route);
      return {
        ...activity,
        ...context,
        busId: agenda.busId,
        originKey: route[0],
        destinationKey: route.at(-1),
      };
    }),
    blocks: agenda.blocks.map((block) => ({ ...block, ...context, busId: agenda.busId })),
  }));
  return {
    programming: parsed,
    pattern: validateRoutePattern({ ...parsed, ...context, agendas }),
  };
}

function shiftRenewalProgramming(programming, allocateId) {
  const period = createDayCyclePeriod(programming);
  const shift = (value) =>
    toScheduledIso(parseScheduledInstant(value, 'instante de renovación') + period.durationMs);
  const requiredIds = new Map(
    programming.requiredServices.map((entry) => [entry.id, allocateId()]),
  );
  return {
    cycleStartDate: new Date(period.endMs + CONTINENTAL_OFFSET_MS).toISOString().slice(0, 10),
    cycleLengthDays: period.cycleLengthDays,
    requiredServices: programming.requiredServices.map((entry) => ({
      ...entry,
      id: requiredIds.get(entry.id),
      departureAt: shift(entry.departureAt),
    })),
    agendas: programming.agendas.map((agenda) => ({
      busId: agenda.busId,
      initialAvailability: {
        ...agenda.initialAvailability,
        availableAt: shift(agenda.initialAvailability.availableAt),
      },
      activities: agenda.activities.map((activity) => ({
        ...activity,
        id: allocateId(),
        departureAt: shift(activity.departureAt),
        arrivalAt: shift(activity.arrivalAt),
        ...(activity.kind === 'SERVICE'
          ? {
              requiredServiceId: requiredIds.get(activity.requiredServiceId),
              points: activity.points.map((point) => ({
                position: point.position,
                ...(point.arrivalAt ? { arrivalAt: shift(point.arrivalAt) } : {}),
                ...(point.departureAt ? { departureAt: shift(point.departureAt) } : {}),
              })),
            }
          : {}),
      })),
      blocks: agenda.blocks.map((block) => ({
        ...block,
        id: allocateId(),
        startAt: shift(block.startAt),
        endAt: shift(block.endAt),
      })),
    })),
  };
}

module.exports = { validateRenewalProgramming, shiftRenewalProgramming };
