const readBookingConfig = require('../../../src/modules/bookings/infrastructure/booking-config');
const calendarDateAt = require('../../../src/modules/bookings/infrastructure/booking-clock');
const createIdentity = require('../../../src/modules/bookings/infrastructure/verified-customer-identity');
const { createBookingsModule } = require('../../../src/modules/bookings');

test.each([
  ['180', 180],
  ['300', 300],
  [undefined, 300],
])('configuración %j produce plazo %j desde un solo origen', (raw, expected) => {
  expect(readBookingConfig({ BOOKING_PROOF_WINDOW_SECONDS: raw })).toEqual({
    proofWindowSeconds: expected,
  });
});
test.each(['179', '301', '', ' ', '180.5', '3e2', '-180', 'Infinity', 300, null])(
  'rechaza configuración inválida %j',
  (raw) => {
    expect(() => readBookingConfig({ BOOKING_PROOF_WINDOW_SECONDS: raw })).toThrow();
  },
);
test.each([
  ['2026-10-29T04:59:59Z', '2026-10-28'],
  ['2026-10-29T05:00:00Z', '2026-10-29'],
  ['2028-03-01T04:59:59Z', '2028-02-29'],
])('fecha local de %s es %s', (instant, expected) => {
  expect(calendarDateAt(new Date(instant))).toBe(expected);
});
test('identidad solo proyecta el ID de un CUSTOMER autenticado', async () => {
  const context = Object.freeze({
    sid: 'sesion',
    user: Object.freeze({
      id: 'comprador',
      role: 'CUSTOMER',
      cooperative_id: null,
      email: 'ficticio@example.ec',
    }),
  });
  const result = await createIdentity().resolve(context);
  expect(result).toEqual({ ownerId: 'comprador' });
  expect(Object.isFrozen(result)).toBe(true);
});
test.each([undefined, {}, { sid: 'x' }, { user: { id: 'x' } }, { sid: ' ', user: { id: 'x' } }])(
  'contexto sin sesión/usuario rechaza: %j',
  async (context) => {
    await expect(createIdentity().resolve(context)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  },
);
test.each([
  { id: 'x', role: 'SYSTEM_ADMIN', cooperative_id: null },
  { id: 'x', role: 'CLERK', cooperative_id: 'coop' },
  { id: 'x', role: 'CUSTOMER', cooperative_id: 'coop' },
  { id: 'x', role: 'CUSTOMER' },
])('no admite rol/contexto interno para compra CUSTOMER: %j', async (user) => {
  await expect(createIdentity().resolve({ sid: 'sesion', user })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
});
test('composición rechaza puertos incompletos en vez de aparentar un servicio operativo', () => {
  expect(() => createBookingsModule()).toThrow('No se pudo componer');
  const auth = { authenticate() {}, authorize() {}, csrfProtection() {} };
  expect(() => createBookingsModule({ pool: { connect() {} }, auth, tripCatalog: {} })).toThrow(
    'No se pudo componer',
  );
});
