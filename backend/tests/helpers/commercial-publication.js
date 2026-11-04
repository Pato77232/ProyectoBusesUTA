const { randomUUID } = require('node:crypto');

function commercialPublicationFixture() {
  const manifest = {
    seriesId: randomUUID(),
    cycleId: randomUUID(),
    cycleNumber: 1,
    tripIds: [randomUUID()],
  };
  return {
    commercialSession: {
      listSeries: jest.fn(async () => []),
      findPublished: jest.fn(async () => manifest),
      save: jest.fn(async () => manifest),
    },
    seatQueryPort: {
      listByBus: jest.fn(async ({ busId }) => ({
        busId,
        seats: [
          {
            seatId: randomUUID(),
            layoutSeatKey: 'seat-1',
            label: 1,
            deck: 1,
            row: 0,
            column: 0,
            category: 'NORMAL',
            offered: true,
          },
        ],
      })),
    },
  };
}

module.exports = commercialPublicationFixture;
