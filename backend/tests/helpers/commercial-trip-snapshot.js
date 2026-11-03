const { randomUUID } = require('node:crypto');

module.exports = function snapshotFixture() {
  const ids = Object.fromEntries(
    [
      'trip',
      'coop',
      'sheet',
      'assignment',
      'required',
      'frequency',
      'bus',
      'cycle',
      'inventory',
      'series',
      'group',
      'seat',
    ].map((k) => [k, randomUUID()]),
  );
  const startAt = '2030-01-01T05:00:00.000Z',
    endExclusive = '2030-01-03T05:00:00.000Z';
  const departureAt = '2030-01-02T04:00:00.000Z',
    arrivalAt = '2030-01-02T07:00:00.000Z';
  const policy = {
    discountStrategy: 'MAX_ELIGIBLE',
    vipSurchargeBps: 2500,
    minorDiscountBps: 5000,
    seniorDiscountBps: 5000,
    disabilityDiscountBps: 5000,
  };
  const cycle = {
    id: ids.cycle,
    seriesId: ids.series,
    routeSheetId: ids.sheet,
    programmingRevision: 1,
    tariffRevision: 1,
    startAt,
    endExclusive,
    cycleNumber: 1,
  };
  return {
    trip: {
      id: ids.trip,
      cooperativeId: ids.coop,
      routeSheetId: ids.sheet,
      assignmentId: ids.assignment,
      requiredServiceId: ids.required,
      frequencyId: ids.frequency,
      busId: ids.bus,
      cycleId: ids.cycle,
      inventorySnapshotId: ids.inventory,
      programmingRevision: 1,
      tariffRevision: 1,
      departureAt,
      arrivalAt,
      routePoints: [
        { position: 0, locationKey: 'Ambato', departureAt },
        {
          position: 1,
          locationKey: 'Latacunga',
          arrivalAt: '2030-01-02T05:15:00.000Z',
          departureAt: '2030-01-02T05:20:00.000Z',
        },
        { position: 2, locationKey: 'Quito', arrivalAt },
      ],
    },
    sheet: {
      id: ids.sheet,
      cooperativeId: ids.coop,
      busGroupId: ids.group,
      status: 'PUBLISHED',
      tariffRevision: 1,
      tariff: {
        schemaVersion: 1,
        currency: 'USD',
        policy,
        frequencies: [
          {
            frequencyId: ids.frequency,
            routePoints: ['Ambato', 'Latacunga', 'Quito'],
            prices: [
              { fromPosition: 0, toPosition: 1, amountCents: 200 },
              { fromPosition: 0, toPosition: 2, amountCents: 450 },
              { fromPosition: 1, toPosition: 2, amountCents: 300 },
            ],
          },
        ],
      },
    },
    programming: { revision: 1, startAt, endExclusive },
    assignment: {
      id: ids.assignment,
      requiredServiceId: ids.required,
      frequencyId: ids.frequency,
      busId: ids.bus,
      departureAt,
      arrivalAt,
      preparationMinutes: 15,
    },
    required: { id: ids.required, frequencyId: ids.frequency, departureAt },
    inventory: {
      id: ids.inventory,
      busId: ids.bus,
      revision: 1,
      schemaVersion: 1,
      snapshot: {
        schemaVersion: 1,
        busId: ids.bus,
        seats: [
          {
            seatId: ids.seat,
            layoutSeatKey: 'seat-1',
            label: 1,
            deck: 1,
            row: 0,
            column: 0,
            category: 'VIP',
            offered: true,
          },
        ],
      },
    },
    cycle,
    series: {
      id: ids.series,
      cooperativeId: ids.coop,
      busGroupId: ids.group,
      baseRouteSheetId: ids.sheet,
      baseStartAt: startAt,
      baseStartDate: '2030-01-01',
      cycleLengthDays: 2,
    },
    cycles: [{ ...cycle, status: 'PUBLISHED', busGroupId: ids.group }],
  };
};
