const validateBusAgenda = require('../../../../src/modules/route-sheets/domain/services/validate-bus-agenda');
const {
  BusAgendaValidationError,
  BusAgendaConflictError,
} = require('../../../../src/modules/route-sheets/domain/errors/bus-agenda-errors');

const identity = { busId: 'bus-1', cooperativeId: 'coop-1' };
const at = (time, date = '2026-11-02') => `${date}T${time}:00-05:00`;
const activity = (overrides = {}) => ({
  ...identity,
  id: 'a-1',
  kind: 'SERVICE',
  frequencyId: 'freq-1',
  originKey: 'Ambato',
  destinationKey: 'Latacunga',
  departureAt: at('07:00'),
  arrivalAt: at('08:00'),
  preparationMinutes: 15,
  ...overrides,
});
const next = (overrides = {}) =>
  activity({
    id: 'a-2',
    frequencyId: 'freq-2',
    originKey: 'Latacunga',
    destinationKey: 'Quito',
    departureAt: at('08:15'),
    arrivalAt: at('10:00'),
    ...overrides,
  });
const block = (overrides = {}) => ({
  ...identity,
  id: 'block-1',
  kind: 'MAINTENANCE',
  startAt: at('09:00'),
  endAt: at('11:00'),
  ...overrides,
});
const agenda = (overrides = {}) => ({
  ...identity,
  initialAvailability: { locationKey: 'Ambato', availableAt: at('06:00') },
  activities: [activity()],
  blocks: [],
  ...overrides,
});

function expectConflict(input, code, activityId, relatedId) {
  let error;
  try {
    validateBusAgenda(input);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(BusAgendaConflictError);
  expect(error).toMatchObject({ code, httpStatus: 409, activityId, relatedId });
}

describe('Agenda multifrecuencia de un bus', () => {
  test('rechaza salidas simultáneas y detecta conflictos menores a un minuto', () => {
    expectConflict(
      agenda({ activities: [activity(), next({ departureAt: at('07:00') })] }),
      'BUS_AGENDA_TIME_CONFLICT',
      'a-2',
      'a-1',
    );
    expectConflict(
      agenda({ activities: [activity(), next({ departureAt: '2026-11-02T08:14:59.999-05:00' })] }),
      'BUS_AGENDA_TIME_CONFLICT',
      'a-2',
      'a-1',
    );
  });

  test('una actividad TRANSFER también respeta mantenimiento', () => {
    expectConflict(
      agenda({
        activities: [activity({ kind: 'TRANSFER', frequencyId: undefined })],
        blocks: [block({ startAt: at('07:30') })],
      }),
      'BUS_AGENDA_BLOCKED',
      'a-1',
      'block-1',
    );
  });

  test.each(['activities', 'blocks'])(
    'rechaza huecos en la lista de %s con error de dominio',
    (field) => {
      const emptySlot = [];
      emptySlot.length = 1;
      expect(() => validateBusAgenda(agenda({ [field]: emptySlot }))).toThrow(
        BusAgendaValidationError,
      );
    },
  );

  test('ordena servicios sin mutar y permite el circuito Ambato–Latacunga–Quito–Ambato', () => {
    const back = activity({
      id: 'a-3',
      frequencyId: 'freq-3',
      originKey: 'Quito',
      destinationKey: 'Ambato',
      departureAt: at('10:15'),
      arrivalAt: at('13:00'),
    });
    const input = agenda({ activities: [back, activity(), next()] });
    const before = JSON.stringify(input);
    const result = validateBusAgenda(input);
    expect(result.activities.map(({ id }) => id)).toEqual(['a-1', 'a-2', 'a-3']);
    expect(result.activities[0].readyAt).toBe('2026-11-02T13:15:00.000Z');
    expect(JSON.stringify(input)).toBe(before);
    expect(validateBusAgenda(agenda({ activities: [next(), back, activity()] }))).toEqual(result);
  });

  test('devuelve copias inmutables de actividades, bloqueos y disponibilidad', () => {
    const input = agenda({ blocks: [block()] });
    const result = validateBusAgenda(input);
    for (const value of [
      result,
      result.activities,
      result.activities[0],
      result.blocks,
      result.blocks[0],
      result.initialAvailability,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    input.activities[0].originKey = 'Otra ciudad';
    input.blocks[0].kind = 'REST';
    input.initialAvailability.locationKey = 'Otra ciudad';
    expect(result.activities[0].originKey).toBe('Ambato');
    expect(result.blocks[0].kind).toBe('MAINTENANCE');
    expect(result.initialAvailability.locationKey).toBe('Ambato');
  });

  test('admite agenda vacía sin inferir cobertura ni inventar actividades', () => {
    expect(validateBusAgenda(agenda({ activities: [] })).activities).toEqual([]);
  });

  test('permite preparación cero explícita y disponibilidad inicial exacta', () => {
    const input = agenda({
      initialAvailability: { locationKey: 'Ambato', availableAt: at('07:00') },
      activities: [activity({ preparationMinutes: 0 }), next({ departureAt: at('08:00') })],
    });
    expect(validateBusAgenda(input).activities).toHaveLength(2);
  });

  test.each(['08:14', '07:50'])(
    'rechaza segunda salida a las %s por ocupación/preparación',
    (time) => {
      expectConflict(
        agenda({ activities: [activity(), next({ departureAt: at(time) })] }),
        'BUS_AGENDA_TIME_CONFLICT',
        'a-2',
        'a-1',
      );
    },
  );

  test('detecta salida antes de disponibilidad inicial', () => {
    expectConflict(
      agenda({ initialAvailability: { locationKey: 'Ambato', availableAt: at('07:01') } }),
      'BUS_AGENDA_TIME_CONFLICT',
      'a-1',
      null,
    );
  });

  test('rechaza origen inicial ajeno a la ubicación del bus', () => {
    expectConflict(
      agenda({ initialAvailability: { locationKey: 'Quito', availableAt: at('06:00') } }),
      'BUS_AGENDA_LOCATION_CONFLICT',
      'a-1',
      null,
    );
  });

  test('no acepta teletransporte aunque sobre tiempo', () => {
    expectConflict(
      agenda({ activities: [activity(), next({ originKey: 'Ambato' })] }),
      'BUS_AGENDA_LOCATION_CONFLICT',
      'a-2',
      'a-1',
    );
  });

  test('un traslado explícito conecta el lugar previo y siguiente', () => {
    const transfer = activity({
      id: 'transfer-1',
      kind: 'TRANSFER',
      frequencyId: undefined,
      originKey: 'Latacunga',
      destinationKey: 'Quito',
      departureAt: at('08:15'),
      arrivalAt: at('10:00'),
    });
    const last = next({
      originKey: 'Quito',
      destinationKey: 'Ambato',
      departureAt: at('10:15'),
      arrivalAt: at('13:00'),
    });
    const result = validateBusAgenda(agenda({ activities: [activity(), transfer, last] }));
    expect(result.activities[1]).toMatchObject({ kind: 'TRANSFER', frequencyId: null });
    expect(result.activities).toHaveLength(3);
  });

  test('un traslado también ocupa tiempo y exige preparación', () => {
    const transfer = next({ kind: 'TRANSFER', frequencyId: undefined });
    const last = activity({
      id: 'a-3',
      originKey: 'Quito',
      departureAt: at('10:14'),
      arrivalAt: at('13:00'),
    });
    expectConflict(
      agenda({ activities: [activity(), transfer, last] }),
      'BUS_AGENDA_TIME_CONFLICT',
      'a-3',
      'a-2',
    );
  });

  test('acepta Unicode NFC y recorte de espacios sin mutar claves', () => {
    const first = activity({ destinationKey: '  Riobamba\u0301  ' });
    const second = next({ originKey: 'Riobambá' });
    expect(
      validateBusAgenda(agenda({ activities: [first, second] })).activities[0].destinationKey,
    ).toBe('Riobambá');
    expect(first.destinationKey).toBe('  Riobamba\u0301  ');
  });

  test.each(['latacunga', 'Latacungá'])('no fusiona ubicaciones distintas: %s', (originKey) => {
    expectConflict(
      agenda({ activities: [activity(), next({ originKey })] }),
      'BUS_AGENDA_LOCATION_CONFLICT',
      'a-2',
      'a-1',
    );
  });

  test('compara instantes de offsets diferentes y conserva cruce de medianoche', () => {
    const first = activity({ departureAt: at('23:00'), arrivalAt: at('02:00', '2026-11-03') });
    const second = next({
      departureAt: '2026-11-03T07:15:00Z',
      arrivalAt: '2026-11-03T09:00:00+00:00',
    });
    expect(validateBusAgenda(agenda({ activities: [second, first] })).activities[0].readyAt).toBe(
      '2026-11-03T07:15:00.000Z',
    );
    expectConflict(
      agenda({ activities: [first, { ...second, departureAt: '2026-11-03T07:14:00Z' }] }),
      'BUS_AGENDA_TIME_CONFLICT',
      'a-2',
      'a-1',
    );
  });

  test.each(['REST', 'MAINTENANCE'])('respeta %s incluso durante la preparación', (kind) => {
    expectConflict(
      agenda({ blocks: [block({ kind, startAt: at('08:10') })] }),
      'BUS_AGENDA_BLOCKED',
      'a-1',
      'block-1',
    );
  });

  test.each([
    ['06:00', '07:00'],
    ['08:15', '09:00'],
  ])('permite bloqueos adyacentes %s–%s por intervalos semiabiertos', (start, end) => {
    expect(
      validateBusAgenda(agenda({ blocks: [block({ startAt: at(start), endAt: at(end) })] }))
        .activities,
    ).toHaveLength(1);
  });

  test('detecta un bloqueo que contiene todo el servicio', () => {
    expectConflict(
      agenda({ blocks: [block({ startAt: at('06:00'), endAt: at('12:00') })] }),
      'BUS_AGENDA_BLOCKED',
      'a-1',
      'block-1',
    );
  });

  test('incluye en validación servicios aportados de distintas hojas', () => {
    const other = next({ id: 'otra-hoja', departureAt: at('07:45') });
    expectConflict(
      agenda({ activities: [activity(), other] }),
      'BUS_AGENDA_TIME_CONFLICT',
      'otra-hoja',
      'a-1',
    );
  });

  test.each([
    '2026-02-30T07:00:00-05:00',
    '2026-13-02T07:00:00-05:00',
    '2026-11-02T24:00:00-05:00',
    '2026-11-02T07:60:00-05:00',
    '2026-11-02T07:00:60-05:00',
    '2026-11-02T07:00:00+24:00',
    '2026-11-02T07:00:00+05:60',
    '2026-11-02T07:00:00',
    '2026-11-02',
    'mañana',
    null,
    42,
    new Date('2026-11-02T07:00:00Z'),
  ])('rechaza instante inválido %s', (departureAt) => {
    expect(() => validateBusAgenda(agenda({ activities: [activity({ departureAt })] }))).toThrow(
      BusAgendaValidationError,
    );
  });

  test('acepta día bisiesto real, minutos ISO y precisión de milisegundos', () => {
    const input = agenda({
      initialAvailability: { locationKey: 'Ambato', availableAt: '2028-02-29T06:00-05:00' },
      activities: [
        activity({
          departureAt: '2028-02-29T07:00:00.125-05:00',
          arrivalAt: '2028-02-29T08:00-05:00',
        }),
      ],
    });
    expect(validateBusAgenda(input).activities[0].departureAt).toBe('2028-02-29T12:00:00.125Z');
  });

  test.each([undefined, null, -1, 0.5, '15', true, Infinity, Number.MAX_SAFE_INTEGER])(
    'rechaza preparación inválida %s',
    (preparationMinutes) => {
      expect(() =>
        validateBusAgenda(agenda({ activities: [activity({ preparationMinutes })] })),
      ).toThrow(BusAgendaValidationError);
    },
  );

  test.each(['07:00', '06:59'])('rechaza llegada no posterior %s', (time) => {
    expect(() =>
      validateBusAgenda(agenda({ activities: [activity({ arrivalAt: at(time) })] })),
    ).toThrow(BusAgendaValidationError);
  });

  test.each([
    { busId: 'otro' },
    { cooperativeId: 'otra' },
    { id: '' },
    { kind: 'STANDBY' },
    { frequencyId: undefined },
    { originKey: ' ' },
    { destinationKey: null },
  ])('rechaza actividad inconsistente %j', (change) => {
    expect(() => validateBusAgenda(agenda({ activities: [activity(change)] }))).toThrow(
      BusAgendaValidationError,
    );
  });

  test.each([
    { busId: 'otro' },
    { cooperativeId: 'otra' },
    { id: '' },
    { kind: 'STANDBY' },
    { startAt: at('11:00') },
    { startAt: at('12:00') },
    { endAt: '2026-11-02T12:00' },
  ])('rechaza bloqueo inconsistente %j', (change) => {
    expect(() => validateBusAgenda(agenda({ blocks: [block(change)] }))).toThrow(
      BusAgendaValidationError,
    );
  });

  test.each([
    undefined,
    null,
    [],
    {},
    agenda({ busId: '' }),
    agenda({ cooperativeId: '' }),
    agenda({ initialAvailability: null }),
    agenda({ initialAvailability: { locationKey: '', availableAt: at('06:00') } }),
    agenda({ initialAvailability: { locationKey: 'Ambato', availableAt: 'ayer' } }),
    agenda({ activities: null }),
    agenda({ blocks: undefined }),
    agenda({ activities: [null] }),
    agenda({ blocks: [null] }),
    agenda({ activities: [activity(), activity()] }),
    agenda({ blocks: [block(), block()] }),
  ])('rechaza estructura incompleta o identidad repetida %#', (input) => {
    expect(() => validateBusAgenda(input)).toThrow(BusAgendaValidationError);
  });

  test('errores de validación conservan contrato de dominio', () => {
    expect(new BusAgendaValidationError('Inválido')).toMatchObject({
      name: 'BusAgendaValidationError',
      code: 'BUS_AGENDA_INVALID',
      httpStatus: 400,
      message: 'Inválido',
    });
  });
});
