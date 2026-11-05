const createIdentity = require('../../../src/modules/bookings/infrastructure/verified-guest-buyer-identity');
const { createBookingsModule } = require('../../../src/modules/bookings');

const BUYER_ID = '5b770f8a-2f04-4cbe-aed6-3894056f7288';
const grant = Object.freeze({
  principalType: 'GUEST_BUYER',
  guestBuyerId: BUYER_ID,
  email: 'invitada@example.ec',
});

test('deriva propietario separado del usuario registrado solo tras verificación de Auth', async () => {
  const guestEmailAccess = { verify: jest.fn().mockResolvedValue(grant) };
  const identity = createIdentity(guestEmailAccess);
  const context = { guestSessionToken: 'secreto-interno' };
  expect(await identity.resolve(context)).toEqual({
    ownerId: `guest:${BUYER_ID}`,
    contactEmail: 'invitada@example.ec',
  });
  expect(guestEmailAccess.verify).toHaveBeenCalledWith('secreto-interno');
});

test.each([
  undefined,
  {},
  { guestSessionToken: '' },
  { guestSessionToken: 'x', guestBuyerId: BUYER_ID },
])('rechaza contexto sin concesión verificable: %j', async (context) => {
  const guestEmailAccess = {
    verify: jest.fn().mockRejectedValue({ code: 'GUEST_ACCESS_INVALID' }),
  };
  await expect(createIdentity(guestEmailAccess).resolve(context)).rejects.toMatchObject({
    code: 'UNAUTHENTICATED',
  });
});

test.each([
  { ...grant, principalType: 'CUSTOMER' },
  { ...grant, guestBuyerId: 'arbitrario' },
  { ...grant, email: 'Otra@Example.ec' },
  { ...grant, email: '' },
  null,
])('rechaza concesión mal formada: %j', async (value) => {
  const guestEmailAccess = { verify: jest.fn().mockResolvedValue(value) };
  await expect(
    createIdentity(guestEmailAccess).resolve({ guestSessionToken: 'secreto' }),
  ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
});

test('compone resumen y reserva de invitado sin publicarlos como ruta HTTP', async () => {
  const tripCatalog = { findBookableById: jest.fn().mockResolvedValue(null) };
  const guestEmailAccess = { verify: jest.fn().mockResolvedValue(grant) };
  const bookings = createBookingsModule({
    pool: { connect() {} },
    auth: { authenticate() {}, authorize: () => () => {}, csrfProtection() {} },
    env: {},
    tripCatalog,
    guestEmailAccess,
  });
  expect(typeof bookings.guestPurchase.getSummary).toBe('function');
  expect(typeof bookings.guestPurchase.createBooking).toBe('function');
  const input = { tripId: 'viaje', fromPosition: 0, toPosition: 1, seatIds: [], passengers: [] };
  await expect(bookings.guestPurchase.getSummary(input, {})).rejects.toMatchObject({
    code: 'UNAUTHENTICATED',
  });
  expect(tripCatalog.findBookableById).not.toHaveBeenCalled();
  await expect(
    bookings.guestPurchase.getSummary(input, { guestSessionToken: 'secreto' }),
  ).rejects.toMatchObject({ code: 'BOOKING_TRIP_UNAVAILABLE' });
  expect(tripCatalog.findBookableById).toHaveBeenCalledWith('viaje');
});
