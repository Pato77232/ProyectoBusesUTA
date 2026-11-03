const findForPayment = require('../../../src/modules/bookings/application/find-for-payment.use-case');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const { row, customer, clerk, query } = require('./helpers/payment-booking-fixtures');

let repository;
let read;
const NOW = '2026-11-02T14:04:59.999Z';
beforeEach(() => {
  repository = { findPaymentRecord: jest.fn(async () => row()) };
  read = findForPayment({ repository, clock: () => new Date(NOW) });
});

test('devuelve importe y plazo persistidos sin pasajeros ni claves y omite ownerId al oficinista', async () => {
  const own = await read(query(), customer());
  expect(own).toEqual({
    bookingId: 'reserva-1',
    cooperativeId: 'cooperativa-1',
    status: 'PENDING_PAYMENT',
    ownerId: 'cliente-1',
    totalPriceCents: 875,
    currency: 'USD',
    createdAt: '2026-11-02T13:00:00.000Z',
    proofWindowStartedAt: '2026-11-02T14:00:00.000Z',
    proofWindowSeconds: 300,
    expiresAt: '2026-11-02T14:05:00.000Z',
    evaluatedAt: NOW,
    canUploadProof: true,
  });
  expect(Object.isFrozen(own)).toBe(true);
  const internal = await read(query('REVIEW_PAYMENT'), clerk());
  expect(internal).toEqual(
    Object.fromEntries(Object.entries(own).filter(([key]) => key !== 'ownerId')),
  );
});

test.each([
  null,
  {},
  { bookingId: '' },
  { ...query(), bookingId: 1 },
  { ...query(), bookingId: ' ' },
  { ...query(), purpose: 'OTHER' },
  { ...query(), cooperativeId: 'otra' },
  { ...query(), price: 1 },
  [],
])('consulta inválida no lee datos: %j', async (input) => {
  await expect(read(input, customer())).rejects.toMatchObject({ code: 'BOOKING_VALIDATION_ERROR' });
  expect(repository.findPaymentRecord).not.toHaveBeenCalled();
});

test.each([null, {}, [], { userId: '' }, { userId: 2 }])(
  'rechaza falta de identidad: %j',
  async (context) => {
    await expect(read(query(), context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(repository.findPaymentRecord).not.toHaveBeenCalled();
  },
);

test.each([
  ['UPLOAD_PROOF', { ...customer(), cooperativeId: 'cooperativa-1' }],
  ['UPLOAD_PROOF', clerk()],
  ['REVIEW_PAYMENT', customer()],
  ['REVIEW_PAYMENT', { ...clerk(), cooperativeId: null }],
  ['REVIEW_PAYMENT', { ...clerk(), cooperativeId: ' ' }],
  ['REVIEW_PAYMENT', { ...clerk(), role: 'COOPERATIVE_ADMIN' }],
  ['UPLOAD_PROOF', { ...customer(), role: 'SYSTEM_ADMIN' }],
  ['UPLOAD_PROOF', { ...customer(), role: 'GUEST' }],
  ['REVIEW_PAYMENT', { ...clerk(), role: 'SERVICE' }],
])('sin permisos no consulta: %s %j', async (purpose, context) => {
  await expect(read(query(purpose), context)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(repository.findPaymentRecord).not.toHaveBeenCalled();
});

test('ausente y ajena no revelan existencia ni validan datos privados corruptos', async () => {
  repository.findPaymentRecord
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(row({ owner_id: 'otro', total_price_cents: null }))
    .mockResolvedValueOnce(row({ cooperative_id: 'otra', total_price_cents: null }));
  expect(await read(query(), customer())).toBeNull();
  expect(await read(query(), customer())).toBeNull();
  expect(await read(query('REVIEW_PAYMENT'), clerk())).toBeNull();
});

test.each([
  ['2026-11-02T14:04:59.999Z', true],
  ['2026-11-02T14:05:00.000Z', false],
  ['2026-11-02T14:05:00.001Z', false],
])('evalúa límite exacto sin cambiar plazo: %s', async (now, expected) => {
  const lookup = findForPayment({ repository, clock: () => new Date(now) });
  const result = await lookup(query(), customer());
  expect(result.canUploadProof).toBe(expected);
  expect(result.expiresAt).toBe('2026-11-02T14:05:00.000Z');
});

test.each([180, 300])(
  'conserva duración efectiva %i aunque createdAt sea diferente',
  async (seconds) => {
    repository.findPaymentRecord.mockResolvedValue(
      row({
        proof_window_seconds: seconds,
        expires_at: new Date(Date.parse('2026-11-02T14:00:00Z') + seconds * 1000),
      }),
    );
    expect((await read(query(), customer())).proofWindowSeconds).toBe(seconds);
  },
);

test('recepción comprobada impide carga inicial sin expirar ni exponer su identidad', async () => {
  repository.findPaymentRecord.mockResolvedValue(
    row({
      proof_reception_state: 'RECEIVED',
      accepted_proof_id: 'comprobante-1',
      proof_received_at: new Date('2026-11-02T14:01:00Z'),
    }),
  );
  const result = await read(query(), customer());
  expect(result.canUploadProof).toBe(false);
  expect(result).not.toHaveProperty('acceptedProofId');
});

test.each([
  { proof_reception_state: 'UNKNOWN' },
  { proof_reception_state: 'OTHER' },
  { proof_reception_state: undefined },
  { proof_window_started_at: null },
  { proof_window_seconds: 179 },
  { proof_window_seconds: 301 },
  { proof_window_seconds: 180.5 },
  { expires_at: new Date('2026-11-02T14:05:00.001Z') },
  { created_at: new Date('invalid') },
  { currency: undefined },
  { currency: 'EUR' },
  { total_price_cents: null },
  { total_price_cents: '875.5' },
  { total_price_cents: '9007199254740992' },
  { total_price_cents: -1 },
  { summary_total: '874' },
  { status: 'UNKNOWN' },
  { id: 'otra' },
  { accepted_proof_id: 'prueba' },
  { proof_received_at: new Date('2026-11-02T14:01:00Z') },
  { proof_reception_state: 'RECEIVED', accepted_proof_id: 'prueba', proof_received_at: null },
  {
    proof_reception_state: 'RECEIVED',
    accepted_proof_id: 'prueba',
    proof_received_at: new Date('2026-11-02T14:05:00Z'),
  },
])('datos no acreditados o incoherentes no generan elegibilidad: %j', async (changes) => {
  repository.findPaymentRecord.mockResolvedValue(row(changes));
  await expect(read(query(), customer())).rejects.toMatchObject({
    code: 'BOOKING_DATA_INTEGRITY_ERROR',
  });
});

test('cero explícito se representa sin inventarlo cuando falta el dato', async () => {
  repository.findPaymentRecord.mockResolvedValue(
    row({ total_price_cents: '0', summary_total: '0' }),
  );
  expect((await read(query(), customer())).totalPriceCents).toBe(0);
});

test('copiar consulta y contexto antes del await protege el alcance', async () => {
  let release;
  repository.findPaymentRecord.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const input = query();
  const principal = customer();
  const result = read(input, principal);
  input.bookingId = 'otra';
  input.purpose = 'REVIEW_PAYMENT';
  principal.userId = 'otro';
  release(row());
  expect((await result).bookingId).toBe('reserva-1');
  expect(repository.findPaymentRecord.mock.calls[0][0]).toMatchObject({
    userId: 'cliente-1',
    purpose: 'UPLOAD_PROOF',
  });
});

test.each(['BOOKING_QUERY_UNAVAILABLE', 'XX000', undefined])(
  'propaga error seguro y no SQL: %s',
  async (code) => {
    repository.findPaymentRecord.mockRejectedValue(
      Object.assign(new Error('SQL privado'), { code }),
    );
    try {
      await read(query(), customer());
      throw new Error('Debió fallar');
    } catch (error) {
      expect(error.code).toBe(code === 'BOOKING_QUERY_UNAVAILABLE' ? code : 'INTERNAL_ERROR');
      expect(error.message).not.toContain('SQL privado');
    }
  },
);

test('reloj inválido se clasifica como error interno y no corrupción de datos', async () => {
  const invalidClock = findForPayment({ repository, clock: () => new Date('invalid') });
  await expect(invalidClock(query(), customer())).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
});

test.each([
  ['ECONNREFUSED', 'BOOKING_QUERY_UNAVAILABLE'],
  ['ETIMEDOUT', 'BOOKING_QUERY_UNAVAILABLE'],
  ['57P03', 'BOOKING_QUERY_UNAVAILABLE'],
  ['53300', 'BOOKING_QUERY_UNAVAILABLE'],
  ['42P01', 'INTERNAL_ERROR'],
  ['23514', 'INTERNAL_ERROR'],
  [undefined, 'INTERNAL_ERROR'],
])('infraestructura clasifica %s sin convertir todo a temporal', async (code, expected) => {
  const pg = new PgBookingRepository({
    pool: { query: jest.fn().mockRejectedValue(Object.assign(new Error('privado'), { code })) },
  });
  await expect(
    pg.findPaymentRecord({ bookingId: 'x', purpose: 'UPLOAD_PROOF', userId: 'cliente' }),
  ).rejects.toMatchObject({ code: expected });
});

test('reserva expirada conserva lectura autorizada con carga deshabilitada', async () => {
  const { paymentBooking } = require('../../../src/modules/bookings/domain/payment-booking');
  const { row, query, customer } = require('./helpers/payment-booking-fixtures');
  const { paymentReadRequest } = require('../../../src/modules/bookings/domain/payment-booking');
  const response = paymentBooking(
    row({ status: 'EXPIRED' }),
    paymentReadRequest(query(), customer()),
    new Date('2026-11-02T14:06:00Z'),
  );
  expect(response.status).toBe('EXPIRED');
  expect(response.canUploadProof).toBe(false);
});
