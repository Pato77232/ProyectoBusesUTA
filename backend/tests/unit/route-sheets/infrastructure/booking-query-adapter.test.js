const BookingQueryAdapter = require('../../../../src/modules/route-sheets/infrastructure/adapters/booking-query-adapter');

const createQueries = (overrides = {}) => ({
  hasPassengersForBusOnRouteSheet: jest.fn().mockResolvedValue(false),
  hasPassengersForAssignment: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe('BookingQueryAdapter', () => {
  it('delega la consulta por hoja, bus y cooperativa', async () => {
    const bookingQueries = createQueries();
    const adapter = new BookingQueryAdapter({ bookingQueries });

    await expect(adapter.hasPassengersForBusOnRouteSheet('sheet', 'bus', 'coop')).resolves.toBe(
      false,
    );
    expect(bookingQueries.hasPassengersForBusOnRouteSheet).toHaveBeenCalledWith(
      'sheet',
      'bus',
      'coop',
    );
  });

  it('delega la consulta por asignación y cooperativa', async () => {
    const bookingQueries = createQueries();
    const adapter = new BookingQueryAdapter({ bookingQueries });

    await expect(adapter.hasPassengersForAssignment('assignment', 'coop')).resolves.toBe(true);
    expect(bookingQueries.hasPassengersForAssignment).toHaveBeenCalledWith('assignment', 'coop');
  });

  it('no interpreta la ausencia del proveedor como ausencia de pasajeros', async () => {
    const adapter = new BookingQueryAdapter();

    await expect(adapter.hasPassengersForAssignment('assignment', 'coop')).rejects.toMatchObject({
      code: 'BOOKING_QUERIES_UNAVAILABLE',
      httpStatus: 503,
    });
  });

  it('rechaza un contrato parcial al componer', () => {
    expect(
      () => new BookingQueryAdapter({ bookingQueries: { hasPassengersForAssignment: jest.fn() } }),
    ).toThrow('bookingQueries requiere: hasPassengersForBusOnRouteSheet.');
  });

  it('propaga errores del proveedor y rechaza resultados que no sean booleanos', async () => {
    const failure = new Error('booking database unavailable');
    const adapter = new BookingQueryAdapter({
      bookingQueries: createQueries({
        hasPassengersForAssignment: jest.fn().mockRejectedValue(failure),
      }),
    });
    await expect(adapter.hasPassengersForAssignment('assignment', 'coop')).rejects.toBe(failure);

    const invalidAdapter = new BookingQueryAdapter({
      bookingQueries: createQueries({
        hasPassengersForAssignment: jest.fn().mockResolvedValue(undefined),
      }),
    });
    await expect(invalidAdapter.hasPassengersForAssignment('assignment', 'coop')).rejects.toThrow(
      'debe devolver un booleano',
    );
  });
});
