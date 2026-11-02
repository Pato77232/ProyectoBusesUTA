const { randomUUID } = require('node:crypto');

function programmingFixture({
  cooperativeId = randomUUID(),
  busGroupId = randomUUID(),
  busId = randomUUID(),
  date = '2026-11-02',
} = {}) {
  const frequencyIds = [randomUUID(), randomUUID(), randomUUID()];
  const routes = [
    ['Ambato', 'Latacunga', '07:00', '08:00'],
    ['Latacunga', 'Quito', '08:15', '10:00'],
    ['Quito', 'Ambato', '10:15', '13:00'],
  ];
  const frequencies = frequencyIds.map((id, index) => ({
    id,
    cooperativeId,
    origin: routes[index][0],
    destination: routes[index][1],
    departureTime: routes[index][2],
    antResolutionNumber: 'ANT-FICTICIA',
    status: 'ACTIVE',
    stops: [],
  }));
  const activities = frequencies.map((frequency, index) => {
    const departureAt = `${date}T${routes[index][2]}:00-05:00`;
    const arrivalAt = `${date}T${routes[index][3]}:00-05:00`;
    return {
      id: randomUUID(),
      kind: 'SERVICE',
      frequencyId: frequency.id,
      requiredServiceId: randomUUID(),
      departureAt,
      arrivalAt,
      preparationMinutes: 15,
      points: [
        { position: 0, departureAt },
        { position: 1, arrivalAt },
      ],
    };
  });
  return {
    cooperativeId,
    busGroupId,
    busId,
    frequencies,
    context: { routeSheetId: randomUUID(), cooperativeId, modifiedBy: randomUUID() },
    body: {
      expectedRevision: 0,
      programming: {
        cycleStartDate: date,
        cycleLengthDays: 1,
        requiredServices: activities.map((a) => ({
          id: a.requiredServiceId,
          frequencyId: a.frequencyId,
          departureAt: a.departureAt,
        })),
        agendas: [
          {
            busId,
            initialAvailability: { availableAt: `${date}T00:00:00-05:00`, locationKey: 'Ambato' },
            activities,
            blocks: [],
          },
        ],
      },
    },
  };
}

module.exports = programmingFixture;
