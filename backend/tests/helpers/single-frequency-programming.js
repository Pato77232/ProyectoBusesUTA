const { randomUUID } = require('node:crypto');

function singleFrequencyProgramming({
  busId,
  frequencyId,
  date = '2026-11-02',
  places = ['Ambato', 'Quito'],
}) {
  const requiredServiceId = randomUUID();
  const departureAt = `${date}T07:00:00-05:00`;
  const arrivalAt = `${date}T10:00:00-05:00`;
  const points = places.map((_place, position) =>
    position === 0
      ? { position, departureAt }
      : position === places.length - 1
        ? { position, arrivalAt }
        : { position, arrivalAt: `${date}T08:00:00-05:00`, departureAt: `${date}T08:00:00-05:00` },
  );
  return {
    expectedRevision: 0,
    programming: {
      cycleStartDate: date,
      cycleLengthDays: 1,
      requiredServices: [{ id: requiredServiceId, frequencyId, departureAt }],
      agendas: [
        {
          busId,
          initialAvailability: { availableAt: `${date}T00:00:00-05:00`, locationKey: places[0] },
          activities: [
            {
              id: randomUUID(),
              kind: 'SERVICE',
              requiredServiceId,
              frequencyId,
              departureAt,
              arrivalAt,
              preparationMinutes: 15,
              points,
            },
            {
              id: randomUUID(),
              kind: 'TRANSFER',
              originKey: places.at(-1),
              destinationKey: places[0],
              departureAt: `${date}T10:15:00-05:00`,
              arrivalAt: `${date}T13:00:00-05:00`,
              preparationMinutes: 15,
            },
          ],
          blocks: [],
        },
      ],
    },
  };
}

function programmingSessionFixture({
  busId,
  frequencyId,
  cooperativeId,
  busGroupId,
  date = '2026-11-02',
  places = ['Ambato', 'Quito'],
}) {
  const { programming } = singleFrequencyProgramming({ busId, frequencyId, date, places });
  programming.agendas[0].activities[0].points.forEach((point, index) => {
    point.locationKey = places[index];
  });
  programming.cooperativeId = cooperativeId;
  programming.busGroupId = busGroupId;
  programming.startAt = new Date(`${date}T00:00:00-05:00`).toISOString();
  programming.endExclusive = new Date(Date.parse(programming.startAt) + 86_400_000).toISOString();
  return {
    record: { revision: 1, programming },
    busQueryPort: { findById: jest.fn(async () => ({ id: busId, cooperativeId, busGroupId })) },
    findCommitments: jest.fn(async () => ({
      programs: [],
      hasLegacyConflicts: false,
      hasLegacyCycles: false,
    })),
  };
}

module.exports = { singleFrequencyProgramming, programmingSessionFixture };
