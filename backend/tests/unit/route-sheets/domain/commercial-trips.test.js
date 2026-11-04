const { randomUUID } = require('node:crypto');
const {
  commercialInventory,
  tripUuid,
} = require('../../../../src/modules/route-sheets/domain/value-objects/commercial-inventory');
const planCycle = require('../../../../src/modules/route-sheets/domain/services/plan-commercial-cycle');
const prepare = require('../../../../src/modules/route-sheets/application/services/prepare-commercial-publication');
const { programmingSessionFixture } = require('../../../helpers/single-frequency-programming');
const commercialFixture = require('../../../helpers/commercial-publication');

const busId = randomUUID();
function inventory() {
  return {
    busId,
    seats: [
      {
        seatId: randomUUID(),
        layoutSeatKey: 'seat-1',
        label: 1,
        deck: 1,
        row: 0,
        column: 0,
        category: 'NORMAL',
        offered: true,
      },
    ],
  };
}

test('excluye espacios accesibles y falla cerrado si una fuente intenta ofrecerlos', () => {
  const source = inventory();
  const accessible = {
    ...source.seats[0],
    seatId: randomUUID(),
    layoutSeatKey: 'wheelchair',
    label: 2,
    category: 'ACCESSIBLE',
    offered: false,
  };
  source.seats.push(accessible);
  expect(commercialInventory(source, busId).seats).toHaveLength(1);
  accessible.offered = true;
  expect(() => commercialInventory(source, busId)).toThrow();
});
function series() {
  return {
    id: randomUUID(),
    baseStartAt: '2030-01-01T05:00:00.000Z',
    cycleLengthDays: 1,
    cycles: [
      {
        cycleNumber: 1,
        status: 'PUBLISHED',
        startAt: '2030-01-01T05:00:00.000Z',
        endExclusive: '2030-01-02T05:00:00.000Z',
      },
    ],
  };
}
const programming = {
  cycleLengthDays: 1,
  startAt: '2030-01-02T05:00:00.000Z',
  endExclusive: '2030-01-03T05:00:00.000Z',
};
const now = '2030-01-01T00:00:00Z';

test('copia ofrecidos sin mutar fuente y conserva identidad/categoría reales', () => {
  const source = inventory();
  source.seats.push({
    ...source.seats[0],
    seatId: randomUUID(),
    layoutSeatKey: 'seat-2',
    label: 2,
    offered: false,
  });
  const before = JSON.parse(JSON.stringify(source));
  const result = commercialInventory(source, busId);
  expect(result.seats).toHaveLength(1);
  expect(result.seats[0]).toEqual(source.seats[0]);
  expect(source).toEqual(before);
  expect(Object.isFrozen(result.seats[0])).toBe(true);
});

test.each(['seatId', 'layoutSeatKey', 'label', 'deck', 'row', 'column', 'category', 'offered'])(
  'rechaza atributo de fuente inválido %s',
  (field) => {
    const source = inventory();
    delete source.seats[0][field];
    expect(() => commercialInventory(source, busId)).toThrow(
      expect.objectContaining({ code: 'COMMERCIAL_TRIP_SOURCE_UNAVAILABLE' }),
    );
  },
);
test.each(['seatId', 'layoutSeatKey', 'label'])(
  'rechaza identidad de asiento duplicada %s',
  (field) => {
    const source = inventory();
    const duplicate = {
      ...source.seats[0],
      seatId: randomUUID(),
      layoutSeatKey: 'seat-2',
      label: 2,
    };
    duplicate[field] = source.seats[0][field];
    source.seats.push(duplicate);
    expect(() => commercialInventory(source, busId)).toThrow(
      expect.objectContaining({ httpStatus: 503 }),
    );
  },
);
test.each([undefined, {}, [], { busId: randomUUID(), seats: [] }])(
  'no acepta proveedor incompleto %#',
  (source) => {
    expect(() => commercialInventory(source, busId)).toThrow(
      expect.objectContaining({ httpStatus: 503 }),
    );
  },
);
test.each([
  null,
  { busId, seats: [] },
  { busId, seats: [{ ...inventory().seats[0], offered: false }] },
])('no inventa asientos cuando no se ofrecen %#', (source) => {
  expect(() => commercialInventory(source, busId)).toThrow(
    expect.objectContaining({ httpStatus: 409 }),
  );
});
test.each([null, '', 12, 'no-uuid'])('valida identificador de serie %s', (value) => {
  expect(() => tripUuid(value)).toThrow(expect.objectContaining({ httpStatus: 400 }));
});

test('primera publicación crea base explícita; continuación exige ID y fecha exacta', () => {
  const first = planCycle({ series: [], programming, now });
  expect(first).toMatchObject({ seriesId: null, cycleNumber: 1 });
  const s = series();
  expect(planCycle({ series: [s], seriesId: s.id, programming, now })).toMatchObject({
    seriesId: s.id,
    cycleNumber: 2,
  });
  expect(() => planCycle({ series: [s], programming, now })).toThrow(
    expect.objectContaining({ code: 'COMMERCIAL_SERIES_CONFLICT' }),
  );
});
test.each(['missing', 'gap', 'length', 'draft', 'broken', 'parallel'])(
  'serie rechaza %s',
  (scenario) => {
    const s = series(),
      p = { ...programming };
    let seriesId = s.id;
    if (scenario === 'missing') seriesId = randomUUID();
    if (scenario === 'gap') {
      p.startAt = '2030-01-03T05:00:00.000Z';
      p.endExclusive = '2030-01-04T05:00:00.000Z';
    }
    if (scenario === 'length') p.cycleLengthDays = 2;
    if (scenario === 'draft') s.cycles[0].status = 'DRAFT';
    if (scenario === 'broken') s.cycles[0].cycleNumber = 2;
    if (scenario === 'parallel') seriesId = undefined;
    expect(() => planCycle({ series: [s], seriesId, programming: p, now })).toThrow();
  },
);
test('dos ciclos no terminados no se convierten en base más dos', () => {
  const s = series();
  s.cycles.push({
    cycleNumber: 2,
    status: 'PUBLISHED',
    startAt: programming.startAt,
    endExclusive: programming.endExclusive,
  });
  expect(() =>
    planCycle({
      series: [s],
      seriesId: s.id,
      programming: {
        ...programming,
        startAt: '2030-01-03T05:00:00.000Z',
        endExclusive: '2030-01-04T05:00:00.000Z',
      },
      now,
    }),
  ).toThrow(expect.objectContaining({ code: 'COMMERCIAL_SERIES_CONFLICT' }));
});
test('historia terminada no consume cupo y conserva numeración al enlazar explícitamente', () => {
  const s = series();
  s.cycles.push({
    cycleNumber: 2,
    status: 'PUBLISHED',
    startAt: programming.startAt,
    endExclusive: programming.endExclusive,
  });
  const next = {
    ...programming,
    startAt: '2030-01-03T05:00:00.000Z',
    endExclusive: '2030-01-04T05:00:00.000Z',
  };
  expect(
    planCycle({ series: [s], seriesId: s.id, programming: next, now: '2030-01-02T05:00:00Z' })
      .cycleNumber,
  ).toBe(3);
});

test('captura inventario una vez por bus y no escribe durante preparación', async () => {
  const session = programmingSessionFixture({
    busId,
    cooperativeId: randomUUID(),
    busGroupId: randomUUID(),
    frequencyId: randomUUID(),
  });
  const f = commercialFixture();
  const result = await prepare({
    ...f,
    programmingRecord: session.record,
    now: '2026-11-01T00:00:00Z',
  });
  expect(result.inventories).toHaveLength(1);
  expect(f.seatQueryPort.listByBus).toHaveBeenCalledWith({
    busId,
    cooperativeId: session.record.programming.cooperativeId,
  });
  expect(f.commercialSession.save).not.toHaveBeenCalled();
});
test('error técnico no se transforma en inventario vacío', async () => {
  const session = programmingSessionFixture({
    busId,
    cooperativeId: randomUUID(),
    busGroupId: randomUUID(),
    frequencyId: randomUUID(),
  });
  const f = commercialFixture();
  f.seatQueryPort.listByBus.mockRejectedValue(new Error('Fallo ficticio'));
  await expect(prepare({ ...f, programmingRecord: session.record, now })).rejects.toMatchObject({
    httpStatus: 503,
  });
});
