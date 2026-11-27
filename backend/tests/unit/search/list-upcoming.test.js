const { randomUUID } = require('node:crypto');
const listUpcoming = require('../../../src/modules/search/application/list-upcoming');

const cooperativeId = randomUUID();
const trip = (extra = {}) => ({
  tripId: randomUUID(),
  cooperativeId,
  fromPosition: 0,
  toPosition: 2,
  boardingAt: '2030-01-01T12:30:00Z',
  arrivalAt: '2030-01-01T14:00:00Z',
  origin: 'Ambato',
  destination: 'Quito',
  stopCount: 1,
  currency: 'USD',
  amountCents: 550,
  passengers: ['secreto'],
  ...extra,
});
const cooperatives = {
  findByIds: jest.fn(async () => [
    { id: cooperativeId, name: 'Cooperativa QA', email: 'privado@example.ec' },
  ]),
};

describe('SEARCH-02: próximas salidas', () => {
  test('sin parámetros pide los próximos 7 días con un límite de 50', async () => {
    const tripSearch = { findUpcoming: jest.fn(async () => ({ trips: [], truncated: false })) };
    const result = await listUpcoming({ tripSearch, cooperativeQueries: cooperatives })({});
    expect(tripSearch.findUpcoming).toHaveBeenCalledWith({
      date: null,
      cooperativeId: null,
      days: 7,
      limit: 50,
    });
    expect(result).toEqual({ trips: [], truncated: false, days: 7 });
  });

  test('pasa la fecha y la cooperativa, y ordena por hora de salida', async () => {
    const later = trip({ boardingAt: '2030-01-01T18:00:00Z' });
    const earlier = trip({ boardingAt: '2030-01-01T08:00:00Z' });
    const tripSearch = {
      findUpcoming: jest.fn(async () => ({ trips: [later, earlier], truncated: true })),
    };
    const coop = cooperativeId.toUpperCase();
    const result = await listUpcoming({ tripSearch, cooperativeQueries: cooperatives })({
      date: '2030-01-01',
      cooperativeId: coop,
    });
    expect(tripSearch.findUpcoming.mock.calls[0][0]).toMatchObject({
      date: '2030-01-01',
      cooperativeId,
    });
    expect(result.trips.map((t) => t.tripId)).toEqual([earlier.tripId, later.tripId]);
    expect(result.truncated).toBe(true);
    expect(result.trips[0]).toMatchObject({ cooperativeName: 'Cooperativa QA', stopCount: 1 });
    expect(JSON.stringify(result)).not.toContain('secreto');
    expect(JSON.stringify(result)).not.toContain('privado@example.ec');
  });

  test.each([
    [{ date: '2030-02-30' }],
    [{ date: 'mañana' }],
    [{ cooperativeId: 'cooperativa-1' }],
    [{ origin: 'Ambato' }],
    [{ date: ['2030-01-01'] }],
  ])('valida %p antes de consultar', async (input) => {
    const tripSearch = { findUpcoming: jest.fn() };
    await expect(
      listUpcoming({ tripSearch, cooperativeQueries: cooperatives })(input),
    ).rejects.toMatchObject({ code: 'SEARCH_INVALID', httpStatus: 400 });
    expect(tripSearch.findUpcoming).not.toHaveBeenCalled();
  });

  test('una fuente caída o datos incoherentes no se presentan como lista vacía', async () => {
    for (const tripSearch of [
      { findUpcoming: jest.fn().mockRejectedValue(new Error('SQL privado')) },
      {
        findUpcoming: jest.fn(async () => ({ trips: [trip({ stopCount: -1 })], truncated: false })),
      },
      { findUpcoming: jest.fn(async () => ({ trips: 'x', truncated: false })) },
    ])
      await expect(
        listUpcoming({ tripSearch, cooperativeQueries: cooperatives })({}),
      ).rejects.toMatchObject({
        code: 'SEARCH_UNAVAILABLE',
        httpStatus: 503,
        message: expect.not.stringContaining('SQL'),
      });
  });
});
