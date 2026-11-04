const {
  createGuestAccess,
  hashToken,
} = require('../../../src/modules/bookings/application/guest-access');

test('consume un token una sola vez y devuelve solo datos de reserva', async () => {
  const client = {
    query: jest
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'access-1',
            expires_at: new Date('2026-11-04T12:00:00Z'),
            used_at: null,
            booking_id: 'booking-1',
            status: 'SOLD',
            trip_id: 'trip-1',
            from_position: 1,
            to_position: 2,
            total_price_cents: 1000,
            currency: 'USD',
            created_at: new Date('2026-11-04T10:00:00Z'),
          },
        ],
      })
      .mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
  const pool = { connect: jest.fn().mockResolvedValue(client) };
  const access = createGuestAccess({ pool, clock: () => new Date('2026-11-04T11:00:00Z') });

  await expect(access.consume('a'.repeat(64))).resolves.toMatchObject({
    bookingId: 'booking-1',
    status: 'SOLD',
  });
  expect(client.query).toHaveBeenCalledWith(
    expect.stringContaining('used_at=$2'),
    expect.any(Array),
  );
  expect(hashToken('a'.repeat(64))).toHaveLength(64);
  expect(client.release).toHaveBeenCalled();
});

test('rechaza tokens con formato insuficiente sin consultar la base', async () => {
  const pool = { connect: jest.fn() };
  const access = createGuestAccess({ pool });
  await expect(access.consume('corto')).rejects.toMatchObject({ code: 'GUEST_ACCESS_INVALID' });
  expect(pool.connect).not.toHaveBeenCalled();
});
