const {
  verifySaleIntent,
  recoverSaleResult,
} = require('../../../src/modules/bookings/domain/booking-sale-attempt');
const BookingSaleError = require('../../../src/modules/bookings/domain/booking-sale-error');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');

const target = Object.freeze({
  bookingId: 'compra-opaca-01',
  cooperativeId: 'cooperativa-01',
  paymentProofId: 'comprobante-01',
});
const intent = Object.freeze({
  ...target,
  proofVersion: 2,
  requestedBy: 'oficinista-01',
  requestedAt: '2026-11-04T05:00:00.000Z',
});
const sale = Object.freeze({
  ...intent,
  currency: 'USD',
  totalPriceCents: 875,
  confirmedAt: '2026-11-04T05:01:00.000Z',
});
function expectCode(action, code) {
  expect(action).toThrow(BookingSaleError);
  try {
    action();
  } catch (error) {
    expect(error.code).toBe(code);
    expect(error.message).not.toContain('comprobante-');
  }
}

test('copia y congela la intención sin modificar la fuente', () => {
  const source = { ...intent };
  const result = verifySaleIntent(target, source);
  expect(result).toEqual(intent);
  expect(Object.isFrozen(result)).toBe(true);
  expect(result).not.toBe(source);
  source.proofVersion = 3;
  source.requestedBy = 'otro';
  expect(result).toEqual(intent);
});

test('conserva identificadores opacos exactos sin convertirlos a UUID ni recortarlos', () => {
  const scope = { ...target, bookingId: ' compra con espacios ' };
  expect(verifySaleIntent(scope, { ...intent, ...scope }).bookingId).toBe(scope.bookingId);
  expectCode(() => verifySaleIntent(scope, intent), 'BOOKING_SALE_LINK_MISMATCH');
});

test.each(['bookingId', 'cooperativeId', 'paymentProofId'])('rechaza otro vínculo %s', (key) => {
  expectCode(
    () => verifySaleIntent(target, { ...intent, [key]: 'otro' }),
    'BOOKING_SALE_LINK_MISMATCH',
  );
  expectCode(
    () => recoverSaleResult(intent, { ...sale, [key]: 'otro' }),
    'BOOKING_SALE_LINK_MISMATCH',
  );
});

test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '2', null, undefined])(
  'no inventa una versión para %s',
  (proofVersion) => {
    expectCode(
      () => verifySaleIntent(target, { ...intent, proofVersion }),
      'BOOKING_SALE_DATA_INTEGRITY_ERROR',
    );
  },
);

test.each(['', ' ', null, undefined, 42])('no acepta actor ausente %s', (requestedBy) => {
  expectCode(
    () => verifySaleIntent(target, { ...intent, requestedBy }),
    'BOOKING_SALE_DATA_INTEGRITY_ERROR',
  );
});

test.each([
  '2026-02-30T00:00:00.000Z',
  '2026-11-04',
  '2026-11-04T05:00:00Z',
  '2026-11-04T00:00:00.000-05:00',
  null,
  undefined,
  new Date('2026-11-04'),
])('exige fecha persistida ISO UTC canónica: %s', (requestedAt) => {
  expectCode(
    () => verifySaleIntent(target, { ...intent, requestedAt }),
    'BOOKING_SALE_DATA_INTEGRITY_ERROR',
  );
});

test.each([
  'bookingId',
  'cooperativeId',
  'paymentProofId',
  'proofVersion',
  'requestedBy',
  'requestedAt',
])('rechaza campo faltante de intención %s', (key) => {
  const source = { ...intent };
  delete source[key];
  expectCode(() => verifySaleIntent(target, source), 'BOOKING_SALE_DATA_INTEGRITY_ERROR');
});

test.each([null, undefined, [], true])('rechaza origen no estructurado %s', (source) => {
  expectCode(() => verifySaleIntent(target, source), 'BOOKING_SALE_DATA_INTEGRITY_ERROR');
});

test('no acepta campos extra ni vínculos vacíos', () => {
  expectCode(
    () => verifySaleIntent(target, { ...intent, paid: true }),
    'BOOKING_SALE_DATA_INTEGRITY_ERROR',
  );
  expectCode(
    () => verifySaleIntent(target, { ...intent, bookingId: ' ' }),
    'BOOKING_SALE_DATA_INTEGRITY_ERROR',
  );
  expect(() => verifySaleIntent({ ...target, proofVersion: 2 }, intent)).toThrow(
    BookingValidationError,
  );
});

test('null es ausencia explícita y undefined no se interpreta como ausencia', () => {
  expect(recoverSaleResult(intent, null)).toBeNull();
  expectCode(() => recoverSaleResult(intent, undefined), 'BOOKING_SALE_DATA_INTEGRITY_ERROR');
  expectCode(
    () => recoverSaleResult({ ...intent, proofVersion: 0 }, null),
    'BOOKING_SALE_DATA_INTEGRITY_ERROR',
  );
});

test('recupera resultado original sin consultar reloj o recalcular importe', () => {
  const previous = { ...sale };
  const result = recoverSaleResult(intent, previous);
  expect(result).toEqual(sale);
  expect(result).not.toBe(previous);
  expect(Object.isFrozen(result)).toBe(true);
  expect(JSON.parse(JSON.stringify(result))).toEqual(sale);
  previous.totalPriceCents = 999;
  expect(result.totalPriceCents).toBe(875);
  expect(recoverSaleResult(intent, sale)).toEqual(result);
});

test('misma clave con versión distinta no es repetición', () => {
  expectCode(
    () => recoverSaleResult({ ...intent, proofVersion: 3 }, sale),
    'BOOKING_SALE_VERSION_MISMATCH',
  );
});

test.each([{ requestedBy: 'otro-oficinista' }, { requestedAt: '2026-11-04T05:00:01.000Z' }])(
  'no sustituye actor o fecha originales por los del reintento %j',
  (change) => {
    expectCode(
      () => recoverSaleResult({ ...intent, ...change }, sale),
      'BOOKING_SALE_DATA_INTEGRITY_ERROR',
    );
  },
);

test.each([
  { currency: 'EUR' },
  { currency: undefined },
  { totalPriceCents: -1 },
  { totalPriceCents: 1.5 },
  { totalPriceCents: '875' },
  { totalPriceCents: Number.MAX_SAFE_INTEGER + 1 },
  { totalPriceCents: undefined },
  { confirmedAt: '2026-11-04T04:59:59.999Z' },
  { confirmedAt: '2026-02-30T05:01:00.000Z' },
  { confirmedAt: undefined },
  { fileKey: '/privado/no-exponer' },
])('rechaza resultado persistido incoherente %j', (change) => {
  expectCode(
    () => recoverSaleResult(intent, { ...sale, ...change }),
    'BOOKING_SALE_DATA_INTEGRITY_ERROR',
  );
});

test('permite precisión al límite seguro sin truncar centavos', () => {
  expect(
    recoverSaleResult(intent, { ...sale, totalPriceCents: Number.MAX_SAFE_INTEGER })
      .totalPriceCents,
  ).toBe(Number.MAX_SAFE_INTEGER);
});

test('validar un resultado de cero no crea una venta ni habilita el flujo gratuito', () => {
  const previous = { ...sale, totalPriceCents: 0, confirmedAt: intent.requestedAt };
  expect(recoverSaleResult(intent, previous)).toEqual(previous);
});

test.each([null, undefined, [], {}])(
  'no recupera resultado sin intento verificable %j',
  (attempt) => {
    expectCode(() => recoverSaleResult(attempt, sale), 'BOOKING_SALE_DATA_INTEGRITY_ERROR');
  },
);

test('el error no propaga códigos o mensajes técnicos desconocidos', () => {
  const error = new BookingSaleError('SQL secreto');
  expect(error.code).toBe('BOOKING_SALE_DATA_INTEGRITY_ERROR');
  expect(error.message).not.toContain('SQL');
});
