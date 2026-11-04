const searchTrips = require('../../../src/modules/search/application/search-trips');
const { randomUUID } = require('node:crypto');
const id = randomUUID(),
  cooperativeId = randomUUID();
const query = { origin: 'Salcedo', destination: 'Latacunga', date: '2030-01-01' };
const trip = {
  tripId: id,
  cooperativeId,
  fromPosition: 1,
  toPosition: 2,
  boardingAt: '2030-01-01T12:30:00Z',
  arrivalAt: '2030-01-01T13:00:00Z',
  origin: 'Salcedo',
  destination: 'Latacunga',
  currency: 'USD',
  amountCents: 250,
  passengers: ['secret'],
};
test('enriquece por API pública y proyecta solo información pública', async () => {
  const tripSearch = { find: jest.fn().mockResolvedValue({ trips: [trip], truncated: false }) };
  const cooperativeQueries = {
    findByIds: jest
      .fn()
      .mockResolvedValue([
        { id: cooperativeId, name: 'Cooperativa QA', email: 'private@example.ec' },
      ]),
  };
  const result = await searchTrips({ tripSearch, cooperativeQueries })(query);
  expect(result.trips[0]).toMatchObject({
    tripId: id,
    cooperativeName: 'Cooperativa QA',
    amountCents: 250,
  });
  expect(JSON.stringify(result)).not.toContain('secret');
  expect(JSON.stringify(result)).not.toContain('private@example.ec');
  expect(cooperativeQueries.findByIds).toHaveBeenCalledWith([cooperativeId]);
});
test.each([
  { ...query, date: '2030-02-30' },
  { ...query, cooperativeId },
  { ...query, origin: ['Salcedo'] },
  { ...query, destination: 'salcedo' },
])('valida antes de consultar %p', async (input) => {
  const tripSearch = { find: jest.fn() };
  await expect(searchTrips({ tripSearch })(input)).rejects.toMatchObject({
    code: 'SEARCH_INVALID',
    httpStatus: 400,
  });
  expect(tripSearch.find).not.toHaveBeenCalled();
});
test('falta de fuente no es ausencia de viajes', async () => {
  const tripSearch = { find: jest.fn().mockRejectedValue(new Error('private SQL')) };
  await expect(searchTrips({ tripSearch })(query)).rejects.toMatchObject({
    code: 'SEARCH_UNAVAILABLE',
    httpStatus: 503,
    message: expect.not.stringContaining('SQL'),
  });
});
