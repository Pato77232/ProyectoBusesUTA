const { createBookingTicketQueries } = require('../../../src/modules/bookings');
const soldRow = require('../../helpers/sold-booking-ticket');
const target = { bookingId: 'venta-opaca/qa', cooperativeId: 'coop-ticket' };
function harness(row = soldRow()) {
  const pool = { query: jest.fn().mockResolvedValue({ rows: row === null ? [] : [row] }) };
  return { pool, query: createBookingTicketQueries({ pool }).findSoldForTicket };
}
test('lectura pública entrega solo datos del boleto, copiados e inmutables', async () => {
  const row = soldRow(),
    h = harness(row);
  const value = await h.query(target);
  expect(Object.keys(value).sort()).toEqual(
    [
      'bookingId',
      'cooperativeId',
      'tripId',
      'fromPosition',
      'toPosition',
      'soldAt',
      'currency',
      'totalPriceCents',
      'passengers',
    ].sort(),
  );
  expect(value).toMatchObject({
    ...target,
    soldAt: '2026-11-04T14:02:00.000Z',
    totalPriceCents: 1000,
  });
  expect(Object.keys(value.passengers[0]).sort()).toEqual(
    ['seatId', 'fullName', 'identificationNumber', 'totalPriceCents'].sort(),
  );
  expect(Object.isFrozen(value)).toBe(true);
  expect(Object.isFrozen(value.passengers)).toBe(true);
  expect(value.passengers.every(Object.isFrozen)).toBe(true);
  row.summary.passengers[0].fullName = 'cambio posterior';
  row.allocations.length = 0;
  expect(value.passengers[0].fullName).toBe('Pasajera QA Uno');
  const [sql, args] = h.pool.query.mock.calls[0];
  expect(args).toEqual([target.bookingId, target.cooperativeId]);
  expect(sql).toContain('WHERE b.id=$1 AND b.cooperative_id=$2');
  expect(sql).not.toMatch(/UPDATE|DELETE|INSERT/);
  expect(h.pool.query).toHaveBeenCalledTimes(1);
});
test.each([
  null,
  undefined,
  {},
  [],
  { ...target, ownerId: 'otro' },
  { ...target, bookingId: '  ' },
  { ...target, cooperativeId: 1 },
  Object.create(target),
])('consulta inválida %j no hace I/O', async (input) => {
  const h = harness();
  await expect(h.query(input)).rejects.toMatchObject({
    code: 'BOOKING_TICKET_QUERY_INVALID',
    httpStatus: 400,
  });
  expect(h.pool.query).not.toHaveBeenCalled();
});
test.each(['PENDING_PAYMENT', 'EXPIRED', 'REJECTED'])(
  'estado %s no habilita boleto',
  async (status) => {
    const row = soldRow();
    row.status = status;
    expect(await harness(row).query(target)).toBeNull();
  },
);
test('ausencia y cooperativa ajena son indistinguibles para el consumidor', async () => {
  const h = harness(null);
  expect(await h.query(target)).toBeNull();
  expect(await h.query({ ...target, cooperativeId: 'otra' })).toBeNull();
  expect(h.pool.query.mock.calls[1][1]).toEqual([target.bookingId, 'otra']);
});
const corruptions = [
  [
    'tenant del proveedor',
    (r) => {
      r.cooperativeId = 'otra';
    },
  ],
  [
    'identidad de venta',
    (r) => {
      r.bookingId = 'otra';
    },
  ],
  [
    'estado desconocido',
    (r) => {
      r.status = 'CONFIRMED';
    },
  ],
  [
    'historia sin formato comercial',
    (r) => {
      delete r.summary.schemaVersion;
    },
  ],
  [
    'scope del resumen',
    (r) => {
      r.summary.tripId = 'otro';
    },
  ],
  [
    'total discrepante',
    (r) => {
      r.totalPriceCents = '1001';
    },
  ],
  [
    'importe fuera de rango',
    (r) => {
      r.totalPriceCents = '9007199254740993';
    },
  ],
  [
    'moneda',
    (r) => {
      r.summary.currency = 'EUR';
    },
  ],
  [
    'sin soldAt',
    (r) => {
      r.soldAt = null;
    },
  ],
  [
    'fecha inválida',
    (r) => {
      r.soldAt = new Date('inválida');
    },
  ],
  [
    'tramo inválido',
    (r) => {
      r.fromPosition = 1;
    },
  ],
  [
    'resumen sin pasajeros',
    (r) => {
      r.summary.passengers = [];
    },
  ],
  [
    'pasajero sin nombre',
    (r) => {
      r.summary.passengers[0].fullName = '';
    },
  ],
  [
    'pasajero sin documento',
    (r) => {
      delete r.summary.passengers[0].identificationNumber;
    },
  ],
  [
    'precio sin snapshot',
    (r) => {
      delete r.summary.passengers[0].quote;
    },
  ],
  [
    'precio negativo',
    (r) => {
      r.summary.passengers[0].quote.totalPriceCents = -1;
    },
  ],
  [
    'precio como texto',
    (r) => {
      r.summary.passengers[0].quote.totalPriceCents = '600';
    },
  ],
  [
    'suma distinta',
    (r) => {
      r.summary.passengers[0].quote.totalPriceCents = 599;
    },
  ],
  [
    'asiento sin asignación',
    (r) => {
      r.allocations.pop();
    },
  ],
  [
    'asignación adicional',
    (r) => {
      r.allocations.push({ ...r.allocations[0], seatId: 'extra' });
    },
  ],
  [
    'pasajero duplicado',
    (r) => {
      r.summary.passengers[1].seatId = 'seat-1';
    },
  ],
  [
    'asignación duplicada',
    (r) => {
      r.allocations[1].seatId = 'seat-1';
    },
  ],
  [
    'asiento reservado',
    (r) => {
      r.allocations[0].status = 'RESERVED';
    },
  ],
  [
    'tenant de asignación',
    (r) => {
      r.allocations[0].cooperativeId = 'otra';
    },
  ],
  [
    'tramo de asignación',
    (r) => {
      r.allocations[0].toPosition = 2;
    },
  ],
];
test.each(corruptions)(
  'venta incoherente: %s falla sin habilitar emisión',
  async (_label, corrupt) => {
    const row = soldRow();
    corrupt(row);
    await expect(harness(row).query(target)).rejects.toMatchObject({
      code: 'BOOKING_TICKET_DATA_INTEGRITY_ERROR',
      httpStatus: 500,
    });
  },
);
test.each([
  ['ECONNRESET', 503],
  ['57P03', 503],
  ['XX000', 500],
  [undefined, 500],
])('fallo %s tiene clasificación segura %s', async (code, httpStatus) => {
  const h = harness();
  h.pool.query.mockRejectedValue(Object.assign(new Error('SQL y datos privados'), { code }));
  await expect(h.query(target)).rejects.toMatchObject({ httpStatus });
  await expect(h.query(target)).rejects.not.toThrow('SQL');
});
test('reintentos recuperan el mismo resultado sin operaciones de escritura', async () => {
  const h = harness();
  expect(await h.query(target)).toEqual(await h.query(target));
  expect(h.pool.query).toHaveBeenCalledTimes(2);
});
test('sin fuente real no se construye un lector simulado', () => {
  expect(() => createBookingTicketQueries()).toThrow(TypeError);
});
