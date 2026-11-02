const validateRoutePattern = require('../../../../src/modules/route-sheets/domain/services/validate-route-pattern');
const {
  RouteProgrammingValidationError,
  RouteProgrammingConflictError,
} = require('../../../../src/modules/route-sheets/domain/errors/route-programming-errors');
const {
  BusAgendaConflictError,
} = require('../../../../src/modules/route-sheets/domain/errors/bus-agenda-errors');

const context = { cooperativeId: 'coop-1', busGroupId: 'group-1' };
const at = (time, date = '2026-11-02') => `${date}T${time}:00-05:00`;
const service = (overrides = {}) => ({
  id: 'a-1',
  busId: 'bus-1',
  cooperativeId: context.cooperativeId,
  kind: 'SERVICE',
  frequencyId: 'freq-1',
  originKey: 'Ambato',
  destinationKey: 'Latacunga',
  departureAt: at('07:00'),
  arrivalAt: at('08:00'),
  preparationMinutes: 15,
  ...overrides,
});
const back = (overrides = {}) =>
  service({
    id: 'a-2',
    frequencyId: 'freq-2',
    originKey: 'Latacunga',
    destinationKey: 'Ambato',
    departureAt: at('08:15'),
    arrivalAt: at('09:15'),
    ...overrides,
  });
const required = (activity, id = activity.id) => ({
  id,
  frequencyId: activity.frequencyId,
  departureAt: activity.departureAt,
});
const agenda = (overrides = {}) => ({
  ...context,
  busId: 'bus-1',
  initialAvailability: { locationKey: 'Ambato', availableAt: at('06:00') },
  activities: [service(), back()],
  blocks: [],
  ...overrides,
});
const pattern = (overrides = {}) => ({
  ...context,
  cycleStartDate: '2026-11-02',
  cycleLengthDays: 1,
  requiredServices: [required(service()), required(back())],
  agendas: [agenda()],
  ...overrides,
});
const copy = (input) => JSON.parse(JSON.stringify(input));

describe('Cobertura y repetición del patrón de ruta', () => {
  test('dos buses distintos pueden servir salidas simultáneas sin compartir identidad', () => {
    const other = agenda({
      busId: 'bus-2',
      activities: [
        service({ id: 'b-1', busId: 'bus-2', frequencyId: 'freq-3' }),
        back({ id: 'b-2', busId: 'bus-2', frequencyId: 'freq-4' }),
      ],
    });
    const value = pattern();
    value.agendas.push(other);
    value.requiredServices.push(...other.activities.map((activity) => required(activity)));
    expect(validateRoutePattern(value).agendas).toHaveLength(2);
  });

  test('la misma frecuencia en otra fecha representa otro servicio requerido', () => {
    const secondDay = [
      service({
        id: 'a-3',
        departureAt: at('07:00', '2026-11-03'),
        arrivalAt: at('08:00', '2026-11-03'),
      }),
      back({
        id: 'a-4',
        departureAt: at('08:15', '2026-11-03'),
        arrivalAt: at('09:15', '2026-11-03'),
      }),
    ];
    const value = pattern({ cycleLengthDays: 2 });
    value.agendas[0].activities.push(...secondDay);
    value.requiredServices.push(...secondDay.map((activity) => required(activity)));
    expect(validateRoutePattern(value).requiredServices).toHaveLength(4);
  });

  test('no reutiliza el ID de una actividad en otro bus', () => {
    const other = agenda({
      busId: 'bus-2',
      activities: [
        service({ busId: 'bus-2', frequencyId: 'freq-3' }),
        back({ id: 'b-2', busId: 'bus-2', frequencyId: 'freq-4' }),
      ],
    });
    const value = pattern();
    value.agendas.push(other);
    value.requiredServices.push(
      ...other.activities.map((activity, index) => required(activity, `b-${index}`)),
    );
    expect(() => validateRoutePattern(value)).toThrow(RouteProgrammingValidationError);
  });

  test.each(['agendas', 'requiredServices'])('rechaza elementos huecos en %s', (field) => {
    const sparse = [];
    sparse.length = 1;
    expect(() => validateRoutePattern(pattern({ [field]: sparse }))).toThrow(
      RouteProgrammingValidationError,
    );
  });

  test('rechaza fin de período fuera de los años admitidos sin normalizarlo silenciosamente', () => {
    expect(() => validateRoutePattern(pattern({ cycleStartDate: '9999-12-31' }))).toThrow(
      RouteProgrammingValidationError,
    );
  });

  test('valida un patrón repetible en días sin depender de semanas ni del reloj', () => {
    const input = pattern();
    const before = copy(input);
    const result = validateRoutePattern(input);
    expect(result).toMatchObject({
      ...context,
      cycleLengthDays: 1,
      startAt: '2026-11-02T05:00:00.000Z',
      endExclusive: '2026-11-03T05:00:00.000Z',
    });
    expect(result.agendas[0].activities.map(({ id }) => id)).toEqual(['a-1', 'a-2']);
    expect(input).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.requiredServices)).toBe(true);
    expect(Object.isFrozen(result.requiredServices[0])).toBe(true);
    expect(Object.isFrozen(result.agendas)).toBe(true);
    expect(Object.isFrozen(result.agendas[0])).toBe(true);
  });

  test('admite tres servicios sucesivos con un solo bus', () => {
    const a = service();
    const b = back({ destinationKey: 'Quito' });
    const c = back({
      id: 'a-3',
      frequencyId: 'freq-3',
      originKey: 'Quito',
      destinationKey: 'Ambato',
      departureAt: at('09:30'),
      arrivalAt: at('12:00'),
    });
    const result = validateRoutePattern(
      pattern({
        requiredServices: [a, b, c].map((value) => required(value)),
        agendas: [agenda({ activities: [c, a, b] })],
      }),
    );
    expect(result.requiredServices).toHaveLength(3);
    expect(result.agendas).toHaveLength(1);
  });

  test('compara salidas por frecuencia e instante aunque tengan otro offset', () => {
    const input = pattern();
    input.requiredServices[0].departureAt = '2026-11-02T12:00:00Z';
    expect(validateRoutePattern(input).requiredServices[0].departureAt).toBe(
      '2026-11-02T12:00:00.000Z',
    );
  });

  test('un traslado no cubre un servicio comercial requerido', () => {
    const input = pattern();
    input.agendas[0].activities[1].kind = 'TRANSFER';
    expect(() => validateRoutePattern(input)).toThrow(
      expect.objectContaining({ code: 'ROUTE_PATTERN_COVERAGE_CONFLICT' }),
    );
    input.requiredServices.pop();
    expect(validateRoutePattern(input).requiredServices).toHaveLength(1);
  });

  test('rechaza un patrón que termina en otra ciudad', () => {
    expect(() =>
      validateRoutePattern(
        pattern({
          agendas: [agenda({ activities: [service()] })],
          requiredServices: [required(service())],
        }),
      ),
    ).toThrow(BusAgendaConflictError);
  });

  test('valida cruce de medianoche con ciclo de dos días', () => {
    const a = service({ departureAt: at('23:00'), arrivalAt: at('02:00', '2026-11-03') });
    const b = back({
      departureAt: at('02:15', '2026-11-03'),
      arrivalAt: at('04:00', '2026-11-03'),
    });
    expect(
      validateRoutePattern(
        pattern({
          cycleLengthDays: 2,
          requiredServices: [required(a), required(b)],
          agendas: [agenda({ activities: [a, b] })],
        }),
      ).cycleLengthDays,
    ).toBe(2);
  });

  test('preparación terminada exactamente en el fin exclusivo no corta el patrón', () => {
    const b = back({ arrivalAt: at('23:45') });
    const result = validateRoutePattern(
      pattern({ agendas: [agenda({ activities: [service(), b] })] }),
    );
    expect(result.agendas[0].activities[1].readyAt).toBe(result.endExclusive);
  });

  test.each([
    { departureAt: at('07:00', '2026-11-01') },
    { arrivalAt: at('00:00', '2026-11-03') },
    { arrivalAt: at('23:46') },
  ])('rechaza actividad o preparación fuera del período %j', (change) => {
    const input = pattern({ agendas: [agenda({ activities: [service(), back(change)] })] });
    expect(() => validateRoutePattern(input)).toThrow();
  });

  test('un servicio que empieza exactamente al final pertenece al siguiente ciclo', () => {
    const input = pattern();
    input.requiredServices[0].departureAt = at('00:00', '2026-11-03');
    expect(() => validateRoutePattern(input)).toThrow(
      expect.objectContaining({ code: 'ROUTE_PATTERN_OUTSIDE_PERIOD' }),
    );
  });

  test.each([
    { startAt: at('23:00', '2026-11-01'), endAt: at('06:00') },
    { startAt: at('23:00'), endAt: at('01:00', '2026-11-03') },
  ])('no corta bloqueos entre ciclos %j', (dates) => {
    const rest = { ...context, busId: 'bus-1', id: 'rest-1', kind: 'REST', ...dates };
    expect(() => validateRoutePattern(pattern({ agendas: [agenda({ blocks: [rest] })] }))).toThrow(
      expect.objectContaining({ code: 'ROUTE_PATTERN_OUTSIDE_PERIOD' }),
    );
  });

  test('repite descanso completo sin convertirlo en servicio ni modificarlo', () => {
    const rest = {
      cooperativeId: context.cooperativeId,
      busId: 'bus-1',
      id: 'rest-1',
      kind: 'REST',
      startAt: at('10:00'),
      endAt: at('20:00'),
    };
    const result = validateRoutePattern(pattern({ agendas: [agenda({ blocks: [rest] })] }));
    expect(result.agendas[0].blocks[0].kind).toBe('REST');
    expect(rest.startAt).toBe(at('10:00'));
  });

  test.each(['missing', 'extra', 'duplicate'])('detecta cobertura %s', (caseName) => {
    const input = pattern();
    if (caseName === 'missing')
      input.requiredServices.push({ id: 'req-3', frequencyId: 'freq-3', departureAt: at('12:00') });
    if (caseName === 'extra') input.requiredServices.pop();
    if (caseName === 'duplicate') {
      const other = agenda({
        busId: 'bus-2',
        activities: [service({ id: 'a-3', busId: 'bus-2' }), back({ id: 'a-4', busId: 'bus-2' })],
      });
      input.agendas.push(other);
    }
    expect(() => validateRoutePattern(input)).toThrow(RouteProgrammingConflictError);
  });

  test('no oculta dos servicios simultáneos del mismo bus', () => {
    const input = pattern();
    input.agendas[0].activities[1].departureAt = at('07:00');
    expect(() => validateRoutePattern(input)).toThrow(BusAgendaConflictError);
  });

  test('acepta listas vacías sin acreditar una publicación o viajes disponibles', () => {
    expect(validateRoutePattern(pattern({ agendas: [], requiredServices: [] })).agendas).toEqual(
      [],
    );
  });

  test.each([undefined, null, 0, -1, 1.5, '20', true, Infinity, Number.MAX_SAFE_INTEGER])(
    'rechaza duración %s',
    (cycleLengthDays) => {
      expect(() => validateRoutePattern(pattern({ cycleLengthDays }))).toThrow(
        RouteProgrammingValidationError,
      );
    },
  );

  test.each(['2026-02-30', '2026-2-01', '2026-11-02T00:00:00-05:00', null])(
    'rechaza fecha local %s',
    (cycleStartDate) => {
      expect(() => validateRoutePattern(pattern({ cycleStartDate }))).toThrow();
    },
  );

  test.each([
    undefined,
    null,
    [],
    {},
    pattern({ cooperativeId: '' }),
    pattern({ busGroupId: '' }),
    pattern({ agendas: null }),
    pattern({ requiredServices: null }),
    pattern({ agendas: [undefined] }),
    pattern({ requiredServices: [undefined] }),
  ])('rechaza estructura incompleta %#', (input) => {
    expect(() => validateRoutePattern(input)).toThrow(RouteProgrammingValidationError);
  });

  test.each(['cooperativeId', 'busGroupId'])('rechaza agenda con %s ajeno', (field) => {
    const input = pattern();
    input.agendas[0][field] = 'otro';
    expect(() => validateRoutePattern(input)).toThrow(RouteProgrammingValidationError);
  });

  test.each(['bus', 'id', 'serviceKey'])('rechaza identidades repetidas %s', (kind) => {
    const input = pattern();
    if (kind === 'bus') input.agendas.push(copy(input.agendas[0]));
    if (kind === 'id') input.requiredServices[1].id = input.requiredServices[0].id;
    if (kind === 'serviceKey')
      input.requiredServices.push({ ...input.requiredServices[0], id: 'otra-identidad' });
    expect(() => validateRoutePattern(input)).toThrow(RouteProgrammingValidationError);
  });

  test('no modifica el snapshot después de que el llamador altera su entrada', () => {
    const input = pattern();
    const result = validateRoutePattern(input);
    input.requiredServices[0].frequencyId = 'otro';
    input.agendas[0].activities[0].originKey = 'Otro';
    expect(result.requiredServices[0].frequencyId).toBe('freq-1');
    expect(result.agendas[0].activities[0].originKey).toBe('Ambato');
  });
});
