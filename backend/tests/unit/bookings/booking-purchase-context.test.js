const { readTrip } = require('../../../src/modules/bookings/application/booking-purchase-context');

const request = Object.freeze({ tripId: 'trip-1', fromPosition: 1, toPosition: 3 });

test('resuelve la tarifa publicada del tramo solicitado y conserva su política', async () => {
  const findPrice = jest.fn().mockResolvedValue({
    amountCents: 450,
    revision: 7,
    policy: {
      vipSurchargeBps: 2500,
      minorDiscountBps: 5000,
      seniorDiscountBps: 5000,
      disabilityDiscountBps: 5000,
    },
  });
  const trip = await readTrip(
    {
      findBookableById: jest.fn().mockResolvedValue({
        tripId: 'trip-1',
        cooperativeId: 'coop-1',
        routeSheetId: 'sheet-1',
        frequencyId: 'frequency-1',
        routePointCount: 4,
        seatIds: ['seat-1'],
        departureDate: '2026-11-04',
      }),
    },
    request,
    { findPrice },
  );

  expect(findPrice).toHaveBeenCalledWith({
    routeSheetId: 'sheet-1',
    cooperativeId: 'coop-1',
    frequencyId: 'frequency-1',
    fromPosition: 1,
    toPosition: 3,
  });
  expect(trip).toMatchObject({
    publishedPriceCents: 450,
    tariffRevision: 7,
  });
  expect(trip.tariffPolicy).toEqual(expect.objectContaining({ vipSurchargeBps: 2500 }));
});
