const http = require('node:http');
const express = require('express');
const createApp = require('../../../src/app');
const BookingsPaymentQueryAdapter = require('../../../src/modules/payments/infrastructure/bookings-payment-query-adapter');

const QUERY = Object.freeze({ bookingId: 'reserva-opaca', purpose: 'UPLOAD_PROOF' });
const CUSTOMER = Object.freeze({ userId: 'comprador-1', role: 'CUSTOMER', cooperativeId: null });
const REVIEW = Object.freeze({ ...QUERY, purpose: 'REVIEW_PAYMENT' });
const CLERK = Object.freeze({ userId: 'oficinista-1', role: 'CLERK', cooperativeId: 'coop-1' });
const BOOKING = Object.freeze({
  bookingId: QUERY.bookingId,
  ownerId: CUSTOMER.userId,
  cooperativeId: CLERK.cooperativeId,
  status: 'PENDING_PAYMENT',
  totalPriceCents: 875,
  currency: 'USD',
  createdAt: '2026-11-02T13:59:00.000Z',
  proofWindowStartedAt: '2026-11-02T14:00:00.000Z',
  proofWindowSeconds: 300,
  expiresAt: '2026-11-02T14:05:00.000Z',
  evaluatedAt: '2026-11-02T14:04:59.999Z',
  canUploadProof: true,
});

function harness(booking = BOOKING) {
  const paymentQueries = { findForPayment: jest.fn().mockResolvedValue(booking) };
  return { paymentQueries, adapter: new BookingsPaymentQueryAdapter({ paymentQueries }) };
}

test('exige una API de lectura explícita y no crea un proveedor simulado implícito', () => {
  expect(() => new BookingsPaymentQueryAdapter()).toThrow(TypeError);
  expect(() => new BookingsPaymentQueryAdapter({ paymentQueries: {} })).toThrow(TypeError);
});

test('envía dos argumentos mínimos e inmutables y no conserva tokens, sid o email', async () => {
  const { adapter, paymentQueries } = harness();
  const context = Object.freeze({
    ...CUSTOMER,
    sid: 'sid-sintético',
    token: 'no-transferir',
    email: 'qa@example.ec',
  });

  const result = await adapter.findForPayment(QUERY, context);
  expect(paymentQueries.findForPayment).toHaveBeenCalledWith(QUERY, CUSTOMER);
  const [querySent, contextSent] = paymentQueries.findForPayment.mock.calls[0];
  expect(Object.isFrozen(querySent)).toBe(true);
  expect(Object.isFrozen(contextSent)).toBe(true);
  expect(contextSent).not.toBe(context);
  expect(Object.keys(contextSent).sort()).toEqual(['cooperativeId', 'role', 'userId']);
  expect(result).toMatchObject({
    bookingId: QUERY.bookingId,
    total: 875,
    currency: 'USD',
    ownerId: CUSTOMER.userId,
    acceptsPaymentProof: true,
  });
  expect(Object.isFrozen(result)).toBe(true);
});

test('conserva inicio explícito distinto de creación, total y vencimiento persistidos', async () => {
  const { adapter } = harness();
  const result = await adapter.findForPayment(QUERY, CUSTOMER);
  expect(result.createdAt).toBe(BOOKING.createdAt);
  expect(result.proofWindowStartedAt).toBe(BOOKING.proofWindowStartedAt);
  expect(result.proofWindowSeconds).toBe(300);
  expect(result.expiresAt).toBe(BOOKING.expiresAt);
  expect(result.total).toBe(875);
  expect(result).not.toHaveProperty('totalPriceCents');
});

test('la revisión de CLERK omite propietario y estructuras privadas aunque el proveedor las incluya', async () => {
  const { adapter } = harness({
    ...BOOKING,
    passengers: [{ document: 'no-exponer' }],
    summary: { private: true },
    fileKey: 'ruta-privada',
  });
  const result = await adapter.findForPayment(REVIEW, CLERK);
  expect(result.total).toBe(875);
  for (const field of ['ownerId', 'passengers', 'summary', 'fileKey', 'sid', 'token']) {
    expect(result).not.toHaveProperty(field);
  }
});

test.each([
  [QUERY, CUSTOMER],
  [REVIEW, CLERK],
])('conserva null indistinguible para ausencia o lectura ajena (%j)', async (query, context) => {
  const { adapter } = harness(null);
  await expect(adapter.findForPayment(query, context)).resolves.toBeNull();
});

test('no entrega una reserva de otro propietario aunque el proveedor la devuelva', async () => {
  const { adapter } = harness({ ...BOOKING, ownerId: 'otro-comprador' });
  await expect(adapter.findForPayment(QUERY, CUSTOMER)).resolves.toBeNull();
});

test('no entrega otra cooperativa al oficinista aunque el proveedor la devuelva', async () => {
  const { adapter } = harness({ ...BOOKING, cooperativeId: 'otra-cooperativa' });
  await expect(adapter.findForPayment(REVIEW, CLERK)).resolves.toBeNull();
});

test('conserva un total cero explícito sin inventar que una reserva sea comercialmente gratuita', async () => {
  const { adapter } = harness({ ...BOOKING, totalPriceCents: 0 });
  await expect(adapter.findForPayment(QUERY, CUSTOMER)).resolves.toMatchObject({ total: 0 });
});

test('permite una duración persistida de 180 segundos sin usar createdAt como inicio', async () => {
  const { adapter } = harness({
    ...BOOKING,
    proofWindowSeconds: 180,
    expiresAt: '2026-11-02T14:03:00.000Z',
    evaluatedAt: '2026-11-02T14:02:59.999Z',
  });
  await expect(adapter.findForPayment(QUERY, CUSTOMER)).resolves.toMatchObject({
    proofWindowSeconds: 180,
    acceptsPaymentProof: true,
  });
});

test('lecturas repetidas pueden cambiar elegibilidad sin reintentar ni prorrogar el plazo', async () => {
  const { adapter, paymentQueries } = harness();
  paymentQueries.findForPayment
    .mockResolvedValueOnce(BOOKING)
    .mockResolvedValueOnce({ ...BOOKING, evaluatedAt: BOOKING.expiresAt, canUploadProof: false });
  expect((await adapter.findForPayment(QUERY, CUSTOMER)).acceptsPaymentProof).toBe(true);
  const later = await adapter.findForPayment(QUERY, CUSTOMER);
  expect(later.acceptsPaymentProof).toBe(false);
  expect(later.expiresAt).toBe(BOOKING.expiresAt);
  expect(paymentQueries.findForPayment).toHaveBeenCalledTimes(2);
});

test('false antes del plazo se conserva sin inventar ausencia o recepción aceptada', async () => {
  const { adapter } = harness({ ...BOOKING, canUploadProof: false });
  await expect(adapter.findForPayment(QUERY, CUSTOMER)).resolves.toMatchObject({
    acceptsPaymentProof: false,
  });
});

test.each([
  undefined,
  QUERY.bookingId,
  {},
  { ...QUERY, bookingId: '' },
  { ...QUERY, bookingId: '   ' },
  { ...QUERY, bookingId: 7 },
  { ...QUERY, purpose: 'SERVICE' },
  { ...QUERY, cooperativeId: 'otro-tenant' },
  { ...QUERY, ownerId: 'otro' },
  { ...QUERY, now: '2026-11-02T14:00:00.000Z' },
])('consulta inválida se rechaza antes del proveedor (%j)', async (query) => {
  const { adapter, paymentQueries } = harness();
  await expect(adapter.findForPayment(query, CUSTOMER)).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
    httpStatus: 400,
  });
  expect(paymentQueries.findForPayment).not.toHaveBeenCalled();
});

test.each([undefined, null, {}, { ...CUSTOMER, userId: '' }])(
  'sin identidad mínima no consulta (%j)',
  async (context) => {
    const { adapter, paymentQueries } = harness();
    await expect(adapter.findForPayment(QUERY, context)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      httpStatus: 401,
    });
    expect(paymentQueries.findForPayment).not.toHaveBeenCalled();
  },
);

test.each([
  [REVIEW, CUSTOMER],
  [QUERY, CLERK],
  [REVIEW, { ...CLERK, cooperativeId: null }],
  [QUERY, { ...CUSTOMER, cooperativeId: 'coop-1' }],
  [REVIEW, { ...CLERK, role: 'COOPERATIVE_ADMIN' }],
  [REVIEW, { ...CLERK, role: 'SYSTEM_ADMIN' }],
  [QUERY, { ...CUSTOMER, role: 'GUEST' }],
  [REVIEW, { ...CLERK, role: 'SERVICE' }],
])('rol, propósito o tenant incoherentes no consultan (%j)', async (query, context) => {
  const { adapter, paymentQueries } = harness();
  await expect(adapter.findForPayment(query, context)).rejects.toMatchObject({
    code: 'FORBIDDEN',
    httpStatus: 403,
  });
  expect(paymentQueries.findForPayment).not.toHaveBeenCalled();
});

test.each([
  ['identidad distinta', { bookingId: 'reserva-equivocada' }],
  ['cooperativa ausente', { cooperativeId: undefined }],
  ['propietario ausente en carga', { ownerId: undefined }],
  ['total ausente', { totalPriceCents: undefined }],
  ['total nulo', { totalPriceCents: null }],
  ['total fraccionario', { totalPriceCents: 1.5 }],
  ['total negativo', { totalPriceCents: -1 }],
  ['total inseguro', { totalPriceCents: Number.MAX_SAFE_INTEGER + 1 }],
  ['moneda ausente', { currency: undefined }],
  ['moneda diferente', { currency: 'EUR' }],
  ['estado no soportado', { status: 'ESTADO_DESCONOCIDO' }],
  ['creación inválida', { createdAt: '2026-02-30T00:00:00.000Z' }],
  ['inicio ausente', { proofWindowStartedAt: undefined }],
  ['fecha como objeto', { proofWindowStartedAt: new Date(BOOKING.proofWindowStartedAt) }],
  ['duración menor', { proofWindowSeconds: 179 }],
  ['duración mayor', { proofWindowSeconds: 301 }],
  ['duración fraccionaria', { proofWindowSeconds: 299.5 }],
  ['vencimiento incoherente', { expiresAt: '2026-11-02T14:05:00.001Z' }],
  ['evaluación ausente', { evaluatedAt: undefined }],
  ['elegibilidad ausente', { canUploadProof: undefined }],
  ['elegibilidad no booleana', { canUploadProof: 'true' }],
  ['true en el límite', { evaluatedAt: BOOKING.expiresAt }],
  ['true después del límite', { evaluatedAt: '2026-11-02T14:05:00.001Z' }],
])('rechaza %s como integridad y no fabrica un DTO', async (label, changes) => {
  const { adapter } = harness({ ...BOOKING, ...changes });
  await expect(adapter.findForPayment(QUERY, CUSTOMER)).rejects.toMatchObject({
    code: 'BOOKING_DATA_INTEGRITY_ERROR',
    httpStatus: 500,
  });
});

test.each([undefined, [], 'dato inválido'])(
  'respuesta sin DTO ni null no se interpreta como ausencia (%j)',
  async (value) => {
    const { adapter, paymentQueries } = harness();
    paymentQueries.findForPayment.mockResolvedValue(value);
    await expect(adapter.findForPayment(QUERY, CUSTOMER)).rejects.toMatchObject({
      code: 'BOOKING_DATA_INTEGRITY_ERROR',
      httpStatus: 500,
    });
  },
);

const ERROR_CASES = [
  ['UNAUTHENTICATED', 401, 'UNAUTHENTICATED'],
  ['FORBIDDEN', 403, 'FORBIDDEN'],
  ['BOOKING_VALIDATION_ERROR', 400, 'BOOKING_VALIDATION_ERROR'],
  ['BOOKING_DATA_INTEGRITY_ERROR', 500, 'BOOKING_DATA_INTEGRITY_ERROR'],
  ['BOOKING_QUERY_UNAVAILABLE', 503, 'BOOKING_QUERY_UNAVAILABLE'],
  ['ECONNRESET', 500, 'INTERNAL_ERROR'],
  ['ERROR_SQL_DESCONOCIDO', 500, 'INTERNAL_ERROR'],
];

test.each(ERROR_CASES)(
  'traduce %s sin confiar en httpStatus/mensaje ni reintentar',
  async (code, status, expected) => {
    const { adapter, paymentQueries } = harness();
    paymentQueries.findForPayment.mockRejectedValue(
      Object.assign(new Error('detalle SQL privado'), { code, httpStatus: 418 }),
    );
    await expect(adapter.findForPayment(QUERY, CUSTOMER)).rejects.toMatchObject({
      code: expected,
      httpStatus: status,
    });
    await expect(adapter.findForPayment(QUERY, CUSTOMER)).rejects.not.toHaveProperty(
      'message',
      'detalle SQL privado',
    );
    expect(paymentQueries.findForPayment).toHaveBeenCalledTimes(2);
  },
);

describe('traducción mediante el middleware HTTP real', () => {
  let server;
  let url;
  let providerCode;

  beforeAll(async () => {
    const paymentQueries = {
      findForPayment: async () => {
        throw Object.assign(new Error('detalle SQL privado'), { code: providerCode });
      },
    };
    const adapter = new BookingsPaymentQueryAdapter({ paymentQueries });
    const router = express.Router();
    // Ruta exclusiva del arnés: no implementa ni autentica un endpoint de producto.
    router.get('/', async (request, response, next) => {
      try {
        response.json(await adapter.findForPayment(QUERY, CUSTOMER));
      } catch (error) {
        next(error);
      }
    });
    server = http.createServer(createApp({ payments: { router } }));
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    url = `http://127.0.0.1:${server.address().port}/api/v1/payment-proofs`;
  });

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test.each(ERROR_CASES)('%s conserva HTTP %s y mensaje seguro', async (code, status, expected) => {
    providerCode = code;
    const response = await fetch(url);
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body).toEqual({ error: { code: expected, message: expect.any(String) } });
    expect(JSON.stringify(body)).not.toContain('detalle SQL privado');
    expect(body.error).not.toHaveProperty('stack');
  });
});
