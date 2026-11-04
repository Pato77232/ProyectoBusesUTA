const { randomUUID } = require('node:crypto');
const plan = require('../../../../src/modules/route-sheets/domain/services/plan-route-sheet-renewal');
const {
  readRenewalRequest,
  assertSameRenewalRequest,
} = require('../../../../src/modules/route-sheets/domain/value-objects/renewal-request');
const {
  createDayCyclePeriod,
} = require('../../../../src/modules/route-sheets/domain/value-objects/day-cycle-period');
const {
  parseTariffRequest,
  createDraftTariff,
} = require('../../../../src/modules/route-sheets/domain/value-objects/draft-tariff');
const fixture = require('../../../helpers/route-programming');

const copy = (value) => globalThis.structuredClone(value);
const shift = (value, days) => new Date(Date.parse(value) + days * 86_400_000).toISOString();

function setup(date = '2030-01-01') {
  const f = fixture({ date });
  const programming = f.body.programming;
  programming.agendas[0].blocks = ['REST', 'MAINTENANCE'].map((kind, index) => ({
    id: randomUUID(),
    kind,
    startAt: `${date}T${15 + index * 2}:00:00-05:00`,
    endAt: `${date}T${16 + index * 2}:00:00-05:00`,
    reason: `${kind} de prueba`,
  }));
  const tariff = createDraftTariff(
    parseTariffRequest({
      expectedRevision: 0,
      policy: {
        vipSurchargeBps: 1234,
        minorDiscountBps: 0,
        seniorDiscountBps: 5000,
        disabilityDiscountBps: 7500,
      },
      frequencies: f.frequencies.map(({ id }) => ({
        frequencyId: id,
        prices: [{ fromPosition: 0, toPosition: 1, amountCents: 499 }],
      })),
    }),
    new Map(f.frequencies.map((entry) => [entry.id, [entry.origin, entry.destination]])),
  );
  const period = createDayCyclePeriod(programming);
  const seriesId = randomUUID();
  return {
    context: { cooperativeId: f.cooperativeId, modifiedBy: f.context.modifiedBy },
    request: {
      sourceRouteSheetId: f.context.routeSheetId,
      expectedProgrammingRevision: 3,
      expectedTariffRevision: 2,
      requestKey: randomUUID(),
    },
    source: {
      routeSheetId: f.context.routeSheetId,
      cooperativeId: f.cooperativeId,
      busGroupId: f.busGroupId,
      status: 'PUBLISHED',
      programmingRevision: 3,
      tariffRevision: 2,
      seriesId,
      programming,
      tariff,
    },
    series: {
      id: seriesId,
      cooperativeId: f.cooperativeId,
      busGroupId: f.busGroupId,
      cycleLengthDays: 1,
      baseStartAt: period.startAt,
      cycles: [
        {
          routeSheetId: f.context.routeSheetId,
          cycleNumber: 1,
          status: 'PUBLISHED',
          startAt: period.startAt,
          endExclusive: period.endExclusive,
        },
      ],
    },
    commitments: { programs: [], hasLegacyConflicts: false, hasLegacyCycles: false },
    now: period.startAt,
    newId: jest.fn(randomUUID),
  };
}

function expectCode(input, code) {
  expect(() => plan(input)).toThrow(expect.objectContaining({ code }));
}

test('prepara solo DRAFT contiguo, con política propia, procedencia e IDs nuevos; no altera historia', () => {
  const input = setup();
  const before = copy({ source: input.source, series: input.series });
  const result = plan(input);
  expect(result).toMatchObject({
    seriesId: input.series.id,
    targetCycleNumber: 2,
    startAt: input.series.cycles[0].endExclusive,
    createdBy: input.context.modifiedBy,
    draft: {
      status: 'DRAFT',
      cooperativeId: input.context.cooperativeId,
      busGroupId: input.source.busGroupId,
      programmingRevision: 1,
      tariffRevision: 1,
    },
  });
  expect(result.draft.routeSheetId).not.toBe(input.source.routeSheetId);
  const target = result.draft.programming;
  const source = input.source.programming;
  expect(target.cycleStartDate).toBe('2030-01-02');
  expect(target.cycleLengthDays).toBe(1);
  source.requiredServices.forEach((entry, index) => {
    expect(target.requiredServices[index]).toMatchObject({
      frequencyId: entry.frequencyId,
      departureAt: shift(entry.departureAt, 1),
    });
    expect(target.requiredServices[index].id).not.toBe(entry.id);
  });
  const from = source.agendas[0],
    to = target.agendas[0];
  expect(to.busId).toBe(from.busId);
  expect(to.initialAvailability.availableAt).toBe(shift(from.initialAvailability.availableAt, 1));
  to.activities.forEach((activity, index) => {
    expect(activity.id).not.toBe(from.activities[index].id);
    expect(activity.requiredServiceId).toBe(target.requiredServices[index].id);
    expect(activity.arrivalAt).toBe(shift(from.activities[index].arrivalAt, 1));
    expect(activity.preparationMinutes).toBe(from.activities[index].preparationMinutes);
  });
  to.blocks.forEach((block, index) => {
    expect(block.id).not.toBe(from.blocks[index].id);
    expect(block.kind).toBe(from.blocks[index].kind);
    expect(block.reason).toBe(from.blocks[index].reason);
    expect(block.startAt).toBe(shift(from.blocks[index].startAt, 1));
    expect(block.endAt).toBe(shift(from.blocks[index].endAt, 1));
  });
  expect(result.draft.tariff).toEqual(input.source.tariff);
  expect(result.draft.tariff).not.toBe(input.source.tariff);
  const editable = copy(result.draft.tariff);
  editable.frequencies[0].prices[0].amountCents = 777;
  expect(input.source.tariff.frequencies[0].prices[0].amountCents).toBe(499);
  expect({ source: input.source, series: input.series }).toEqual(before);
  expect(result).not.toHaveProperty('tripIds');
  expect(result).not.toHaveProperty('inventorySnapshotId');
  expect(result).not.toHaveProperty('confirmedThroughExclusive');
  expect(Object.isFrozen(to.activities[0].points[0])).toBe(true);
});

test('desplaza traslados y mantiene ubicación, sin fabricar servicios comerciales', () => {
  const input = setup();
  const agenda = input.source.programming.agendas[0];
  agenda.activities.push(
    ...[
      ['Ambato', 'Latacunga', '13:15', '14:00'],
      ['Latacunga', 'Ambato', '14:15', '15:00'],
    ].map(([originKey, destinationKey, departure, arrival]) => ({
      id: randomUUID(),
      kind: 'TRANSFER',
      originKey,
      destinationKey,
      departureAt: `2030-01-01T${departure}:00-05:00`,
      arrivalAt: `2030-01-01T${arrival}:00-05:00`,
      preparationMinutes: 0,
    })),
  );
  const result = plan(input).draft.programming;
  expect(result.requiredServices).toHaveLength(3);
  expect(result.agendas[0].activities[3]).toMatchObject({
    kind: 'TRANSFER',
    originKey: 'Ambato',
    destinationKey: 'Latacunga',
    departureAt: '2030-01-02T18:15:00.000Z',
  });
});

test('conserva fechas al cruzar medianoche y todos los puntos de embarque', () => {
  const input = setup();
  const p = input.source.programming;
  p.cycleLengthDays = 2;
  const times = [
    ['2030-01-01T23:00:00-05:00', '2030-01-02T00:30:00-05:00'],
    ['2030-01-02T00:45:00-05:00', '2030-01-02T02:30:00-05:00'],
    ['2030-01-02T02:45:00-05:00', '2030-01-02T05:30:00-05:00'],
  ];
  p.agendas[0].blocks = [];
  p.agendas[0].activities.forEach((a, i) => {
    [a.departureAt, a.arrivalAt] = times[i];
    p.requiredServices[i].departureAt = a.departureAt;
    a.points = [
      { position: 0, departureAt: a.departureAt },
      { position: 1, arrivalAt: a.arrivalAt },
    ];
  });
  p.agendas[0].activities[0].points.splice(1, 0, {
    position: 1,
    arrivalAt: '2030-01-01T23:45:00-05:00',
    departureAt: '2030-01-02T00:00:00-05:00',
  });
  p.agendas[0].activities[0].points[2].position = 2;
  const tariff = copy(input.source.tariff);
  const first = tariff.frequencies.find((f) => f.frequencyId === p.requiredServices[0].frequencyId);
  first.routePoints.splice(1, 0, 'Parada');
  first.prices = [
    { fromPosition: 0, toPosition: 1, amountCents: 100 },
    { fromPosition: 1, toPosition: 2, amountCents: 200 },
    { fromPosition: 0, toPosition: 2, amountCents: 250 },
  ];
  input.source.tariff = tariff;
  const period = createDayCyclePeriod(p);
  input.series.cycleLengthDays = 2;
  input.series.cycles[0].endExclusive = period.endExclusive;
  const result = plan(input);
  expect(result.draft.programming.cycleStartDate).toBe('2030-01-03');
  expect(result.draft.programming.agendas[0].activities[0].points[1].departureAt).toBe(
    '2030-01-04T05:00:00.000Z',
  );
  expect(
    result.draft.tariff.frequencies
      .find((f) => f.frequencyId === first.frequencyId)
      .prices.find((p) => p.fromPosition === 0 && p.toPosition === 2).amountCents,
  ).toBe(250);
});

test('rechaza un tercero y permite prepararlo exactamente al terminar el primero, sin renumerar', () => {
  const input = setup('2030-01-02');
  input.series.baseStartAt = '2030-01-01T05:00:00.000Z';
  input.series.cycles[0].cycleNumber = 2;
  input.series.cycles.unshift({
    routeSheetId: randomUUID(),
    cycleNumber: 1,
    status: 'PUBLISHED',
    startAt: input.series.baseStartAt,
    endExclusive: input.series.cycles[0].startAt,
  });
  input.now = '2030-01-02T04:59:59.999Z';
  expectCode(input, 'COMMERCIAL_SERIES_CONFLICT');
  input.now = '2030-01-02T05:00:00.000Z';
  expect(plan(input).targetCycleNumber).toBe(3);
});

test('los borradores programados consumen cupo aunque la serie solo tenga un publicado', () => {
  const input = setup();
  input.commitments.programs = [1, 2].map((day) => ({
    cooperativeId: input.context.cooperativeId,
    busGroupId: input.source.busGroupId,
    startAt: `2030-01-0${day}T05:00:00.000Z`,
    endExclusive: `2030-01-0${day + 1}T05:00:00.000Z`,
    agendas: [],
  }));
  expectCode(input, 'ROUTE_CYCLE_LIMIT_EXCEEDED');
});

test('comprueba los compromisos ajenos y bloqueos del mismo bus en el nuevo período', () => {
  const input = setup();
  const busId = input.source.programming.agendas[0].busId;
  input.commitments.programs = [
    {
      cooperativeId: input.context.cooperativeId,
      busGroupId: randomUUID(),
      startAt: '2030-01-02T05:00:00.000Z',
      endExclusive: '2030-01-03T05:00:00.000Z',
      agendas: [
        {
          busId,
          cooperativeId: input.context.cooperativeId,
          initialAvailability: { availableAt: '2030-01-01T05:00:00.000Z', locationKey: 'Ambato' },
          activities: [],
          blocks: [
            {
              id: randomUUID(),
              busId,
              cooperativeId: input.context.cooperativeId,
              kind: 'MAINTENANCE',
              startAt: '2030-01-02T11:00:00.000Z',
              endAt: '2030-01-02T18:00:00.000Z',
            },
          ],
        },
      ],
    },
  ];
  expectCode(input, 'BUS_AGENDA_BLOCKED');
});

test.each([
  [
    'origen ausente',
    (i) => {
      i.source = null;
    },
    'ROUTE_RENEWAL_NOT_FOUND',
  ],
  [
    'tenant distinto',
    (i) => {
      i.source.cooperativeId = randomUUID();
    },
    'ROUTE_RENEWAL_NOT_FOUND',
  ],
  [
    'sin proveedor',
    (i) => {
      i.source = undefined;
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
  [
    'origen borrador',
    (i) => {
      i.source.status = 'DRAFT';
    },
    'ROUTE_RENEWAL_NOT_PUBLISHED',
  ],
  [
    'revisión antigua',
    (i) => {
      i.source.programmingRevision++;
    },
    'ROUTE_RENEWAL_REVISION_CONFLICT',
  ],
  [
    'tarifa distinta',
    (i) => {
      i.source.tariffRevision++;
    },
    'ROUTE_RENEWAL_REVISION_CONFLICT',
  ],
  [
    'serie ajena',
    (i) => {
      i.series.cooperativeId = randomUUID();
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
  [
    'ciclo de fuente nulo',
    (i) => {
      i.series.cycles = [null];
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
  [
    'compromisos de otra cooperativa',
    (i) => {
      i.commitments.programs = [{ cooperativeId: randomUUID() }];
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
  [
    'origen intermedio',
    (i) => {
      i.series.cycles[0].routeSheetId = randomUUID();
    },
    'ROUTE_RENEWAL_NOT_LATEST',
  ],
  [
    'período incoherente',
    (i) => {
      i.series.cycles[0].endExclusive = '2030-01-04T05:00:00.000Z';
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
  [
    'tarifa corrupta',
    (i) => {
      i.source.tariff = {};
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
  [
    'servicio sin vínculo',
    (i) => {
      i.source.programming.agendas[0].activities[0].requiredServiceId = randomUUID();
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
  [
    'puntos fuera de orden',
    (i) => {
      i.source.programming.agendas[0].activities[0].points[0].departureAt =
        '2030-01-01T13:00:00-05:00';
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
  [
    'sin compromisos verificables',
    (i) => {
      i.commitments = undefined;
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
  [
    'legado no verificable',
    (i) => {
      i.commitments.hasLegacyConflicts = true;
    },
    'ROUTE_PROGRAMMING_LEGACY_UNVERIFIABLE',
  ],
  [
    'intervalo pasado',
    (i) => {
      i.now = '2030-01-03T05:00:00.000Z';
    },
    'ROUTE_RENEWAL_PERIOD_PASSED',
  ],
  [
    'generador repetido',
    (i) => {
      i.newId = () => i.source.routeSheetId;
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
  [
    'generador inválido',
    (i) => {
      i.newId = () => 'mal';
    },
    'ROUTE_RENEWAL_SOURCE_UNAVAILABLE',
  ],
])('rechaza %s sin tocar el origen', (_name, change, code) => {
  const input = setup();
  change(input);
  const before = copy(input.source);
  expectCode(input, code);
  expect(input.source).toEqual(before);
});

test('normaliza la clave y exige que un reintento repita origen y revisiones', () => {
  const { request } = setup();
  const canonical = readRenewalRequest({
    ...request,
    requestKey: request.requestKey.toUpperCase(),
  });
  expect(canonical).toEqual(request);
  expect(() => assertSameRenewalRequest(canonical, request)).not.toThrow();
  for (const changed of [
    { ...request, expectedTariffRevision: 9 },
    { ...request, sourceRouteSheetId: randomUUID() },
    { ...request, requestKey: randomUUID() },
  ])
    expect(() => assertSameRenewalRequest(canonical, changed)).toThrow(
      expect.objectContaining({ code: 'ROUTE_RENEWAL_REQUEST_CONFLICT' }),
    );
});

test.each([
  { cooperativeId: randomUUID() },
  { seriesId: randomUUID() },
  { cycleStartDate: '2030-01-02' },
  { expectedProgrammingRevision: 0 },
  { expectedTariffRevision: 1.5 },
  { requestKey: 'mal' },
])('la solicitud rechaza datos autoritativos o inválidos: %j', (extra) => {
  expect(() => readRenewalRequest({ ...setup().request, ...extra })).toThrow(
    expect.objectContaining({ code: 'ROUTE_RENEWAL_INVALID' }),
  );
});
