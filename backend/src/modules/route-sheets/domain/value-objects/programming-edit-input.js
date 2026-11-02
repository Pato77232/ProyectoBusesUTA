// Proyección explícita de una lectura normalizada al contrato editable.
function programmingEditInput(programming) {
  return {
    cycleStartDate: programming.cycleStartDate,
    cycleLengthDays: programming.cycleLengthDays,
    requiredServices: programming.requiredServices.map(({ id, frequencyId, departureAt }) => ({
      id,
      frequencyId,
      departureAt,
    })),
    agendas: programming.agendas.map((agenda) => ({
      busId: agenda.busId,
      initialAvailability: { ...agenda.initialAvailability },
      activities: agenda.activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        departureAt: a.departureAt,
        arrivalAt: a.arrivalAt,
        preparationMinutes: a.preparationMinutes,
        ...(a.kind === 'SERVICE'
          ? {
              frequencyId: a.frequencyId,
              requiredServiceId: a.requiredServiceId,
              points: a.points.map(({ position, arrivalAt, departureAt }) => ({
                position,
                ...(arrivalAt ? { arrivalAt } : {}),
                ...(departureAt ? { departureAt } : {}),
              })),
            }
          : { originKey: a.originKey, destinationKey: a.destinationKey }),
      })),
      blocks: agenda.blocks.map(({ id, kind, startAt, endAt, reason }) => ({
        id,
        kind,
        startAt,
        endAt,
        reason,
      })),
    })),
  };
}

module.exports = programmingEditInput;
