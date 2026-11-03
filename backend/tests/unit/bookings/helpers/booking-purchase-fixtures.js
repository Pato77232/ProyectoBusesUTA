const { summaryInput, summaryContext } = require('./booking-summary-fixtures');

function purchaseSetup() {
  const fixture = summaryContext();
  const dependencies = {
    buyerIdentity: { resolve: jest.fn().mockResolvedValue({ ownerId: 'cliente-prueba' }) },
    tripCatalog: { findBookableById: jest.fn().mockResolvedValue(fixture.trip) },
    passengerVerifier: {
      verify: jest
        .fn()
        .mockResolvedValue(
          fixture.passengerBenefits.map((entry) => ({ ...entry, birthDateVerified: true })),
        ),
    },
    clock: jest.fn(() => new Date('2026-10-27T15:00:00.000Z')),
    calendarDateAt: jest.fn((instant) => instant.toISOString().slice(0, 10)),
  };
  return {
    dependencies,
    input: summaryInput(),
    authContext: Object.freeze({ sid: 'sesion-prueba' }),
  };
}
module.exports = purchaseSetup;
