const validateRoutePattern = require('../../domain/services/validate-route-pattern');
const { RouteProgrammingConflictError } = require('../../domain/errors/route-programming-errors');
const { ProgrammingSourceError } = require('../../domain/errors/programming-persistence-errors');
const CONTINENTAL_OFFSET_MILLISECONDS = -5 * 60 * 60 * 1000;

function conflict(code, message) {
  throw new RouteProgrammingConflictError(code, message);
}

function pointsFor(activity, frequency) {
  const places = [frequency.origin, ...frequency.stops, frequency.destination].map((place) => {
    if (typeof place !== 'string' || !place.trim()) throw new ProgrammingSourceError();
    return place.trim().normalize('NFC');
  });
  if (places.length !== activity.points.length)
    conflict('ROUTE_PROGRAMMING_POINTS_CONFLICT', 'El recorrido no coincide con la frecuencia.');
  let previous = Date.parse(activity.departureAt);
  const end = Date.parse(activity.arrivalAt);
  const points = activity.points.map((point, position) => {
    const arrival = Date.parse(point.arrivalAt ?? point.departureAt);
    const departure = Date.parse(point.departureAt ?? point.arrivalAt);
    if (arrival < previous || departure < arrival || departure > end)
      conflict(
        'ROUTE_PROGRAMMING_POINTS_CONFLICT',
        'Las fechas de las paradas no respetan el orden del recorrido.',
      );
    previous = departure;
    return { ...point, locationKey: places[position] };
  });
  if (
    points[0].departureAt !== activity.departureAt ||
    points.at(-1).arrivalAt !== activity.arrivalAt
  )
    conflict(
      'ROUTE_PROGRAMMING_POINTS_CONFLICT',
      'Los extremos del recorrido no coinciden con el servicio.',
    );
  const localTime = new Date(Date.parse(activity.departureAt) + CONTINENTAL_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(11);
  if (localTime !== `${frequency.departureTime}:00.000Z`)
    conflict(
      'ROUTE_PROGRAMMING_DEPARTURE_CONFLICT',
      'La salida debe respetar la hora autorizada de la frecuencia.',
    );
  return { ...activity, originKey: places[0], destinationKey: places.at(-1), points };
}

async function prepareRouteProgramming({
  programming,
  cooperativeId,
  busGroupId,
  busQueryPort,
  frequencyQueryPort,
}) {
  if (!busQueryPort?.findById || !frequencyQueryPort?.findWithStops)
    throw new ProgrammingSourceError();
  const frequencies = new Map();
  const ids = [...new Set(programming.requiredServices.map((s) => s.frequencyId))].sort();
  for (const id of ids) {
    const value = await frequencyQueryPort.findWithStops(id, cooperativeId);
    if (!value)
      conflict(
        'ROUTE_PROGRAMMING_FREQUENCY_CONFLICT',
        'La frecuencia no pertenece a la cooperativa.',
      );
    if (
      value.id !== id ||
      value.cooperativeId !== cooperativeId ||
      !Array.isArray(value.stops) ||
      !/^\d{2}:\d{2}$/.test(value.departureTime) ||
      typeof value.antResolutionNumber !== 'string' ||
      !value.antResolutionNumber.trim()
    )
      throw new ProgrammingSourceError();
    if (value.status !== 'ACTIVE')
      conflict('ROUTE_PROGRAMMING_FREQUENCY_CONFLICT', 'La frecuencia no está activa.');
    frequencies.set(id, value);
  }
  const agendas = [];
  for (const agenda of programming.agendas) {
    const bus = await busQueryPort.findById(agenda.busId, cooperativeId);
    if (!bus) conflict('ROUTE_PROGRAMMING_BUS_CONFLICT', 'El bus no pertenece a la cooperativa.');
    if (bus.id !== agenda.busId || bus.cooperativeId !== cooperativeId)
      throw new ProgrammingSourceError();
    if (bus.busGroupId !== busGroupId)
      conflict('BUS_NOT_IN_ROUTE_SHEET_GROUP', 'El bus no pertenece al grupo de la hoja.');
    const activities = agenda.activities.map((activity) => {
      const context = { ...activity, busId: agenda.busId, cooperativeId };
      if (activity.kind === 'TRANSFER') return context;
      const required = programming.requiredServices.find(
        (s) => s.id === activity.requiredServiceId,
      );
      if (
        !required ||
        required.frequencyId !== activity.frequencyId ||
        required.departureAt !== activity.departureAt
      )
        conflict(
          'ROUTE_PATTERN_COVERAGE_CONFLICT',
          'La asignación no coincide con el servicio requerido.',
        );
      return pointsFor(context, frequencies.get(activity.frequencyId));
    });
    agendas.push({
      ...agenda,
      cooperativeId,
      busGroupId,
      activities,
      blocks: agenda.blocks.map((block) => ({ ...block, busId: agenda.busId, cooperativeId })),
    });
  }
  const normalized = validateRoutePattern({ ...programming, cooperativeId, busGroupId, agendas });
  return {
    ...normalized,
    schemaVersion: 1,
    agendas: normalized.agendas.map((agenda) => {
      const source = agendas.find((value) => value.busId === agenda.busId);
      return {
        ...agenda,
        activities: agenda.activities.map((activity) => ({
          ...activity,
          ...(activity.kind === 'SERVICE'
            ? {
                requiredServiceId: source.activities.find((a) => a.id === activity.id)
                  .requiredServiceId,
                points: source.activities.find((a) => a.id === activity.id).points,
              }
            : {}),
        })),
        blocks: agenda.blocks.map((block) => ({
          ...block,
          reason: source.blocks.find((b) => b.id === block.id).reason,
        })),
      };
    }),
  };
}

module.exports = prepareRouteProgramming;
