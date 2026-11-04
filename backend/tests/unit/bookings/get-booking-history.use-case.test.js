const getBookingHistory = require('../../../src/modules/bookings/application/get-booking-history.use-case');

const auth = { user: { id: 'customer-1', role: 'CUSTOMER' } };

test('lista únicamente con el propietario autenticado y conserva el cursor', async () => {
  const repository = {
    listByOwner: jest.fn().mockResolvedValue({ items: [], nextCursor: 'next' }),
  };
  const history = getBookingHistory({ repository });

  await expect(history.list({ limit: '10', cursor: 'opaque' }, auth)).resolves.toEqual({
    items: [],
    nextCursor: 'next',
  });
  expect(repository.listByOwner).toHaveBeenCalledWith({
    ownerId: 'customer-1',
    cursor: 'opaque',
    limit: 10,
  });
});

test('no permite consultar una reserva que no pertenece al propietario', async () => {
  const repository = { findByOwner: jest.fn().mockResolvedValue(null) };
  const history = getBookingHistory({ repository });

  await expect(history.get('booking-1', auth)).rejects.toMatchObject({
    code: 'BOOKING_ATTEMPT_NOT_FOUND',
  });
  expect(repository.findByOwner).toHaveBeenCalledWith({
    bookingId: 'booking-1',
    ownerId: 'customer-1',
  });
});
