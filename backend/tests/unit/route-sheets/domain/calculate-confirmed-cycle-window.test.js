const calculateWindow = require('../../../../src/modules/route-sheets/domain/services/calculate-confirmed-cycle-window');
const {
  RouteProgrammingValidationError,
  RouteProgrammingConflictError,
} = require('../../../../src/modules/route-sheets/domain/errors/route-programming-errors');

const context = { cooperativeId: 'coop-1', busGroupId: 'group-1' };
const cycle = (id, startDate, status = 'PUBLISHED') => ({ id, ...context, startDate, status });
const input = (overrides = {}) => ({
  ...context,
  cycleStartDate: '2026-11-01',
  cycleLengthDays: 20,
  cycles: [cycle('original-1', '2026-11-01'), cycle('original-2', '2026-11-21')],
  now: '2026-11-01T00:00:00-05:00',
  boardingAt: '2026-12-10T23:59:59.999-05:00',
  ...overrides,
});

describe('Ventana de dos ciclos confirmados', () => {
  test('respeta días calendario al cruzar febrero bisiesto', () => {
    const result = calculateWindow(
      input({
        cycleStartDate: '2028-02-28',
        cycleLengthDays: 1,
        cycles: [cycle('leap-1', '2028-02-28'), cycle('leap-2', '2028-02-29')],
        now: '2028-02-28T00:00:00-05:00',
        boardingAt: '2028-02-29T23:59:59-05:00',
      }),
    );
    expect(result.confirmedThroughExclusive).toBe('2028-03-01T05:00:00.000Z');
    expect(result.boardingAllowed).toBe(true);
  });

  test('no pierde historial antiguo cuando dos ciclos siguientes están vigentes', () => {
    const cycles = [
      cycle('a', '2026-11-01'),
      cycle('b', '2026-11-21'),
      cycle('c', '2026-12-11'),
      cycle('d', '2026-12-31'),
    ];
    const result = calculateWindow(
      input({ cycles, now: '2026-12-11T00:00:00-05:00', boardingAt: '2027-01-19T12:00:00-05:00' }),
    );
    expect(result.cycles.map(({ id }) => id)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.confirmedThroughExclusive).toBe('2027-01-20T05:00:00.000Z');
    expect(result.confirmedFromInclusive).toBe('2026-12-11T05:00:00.000Z');
    expect(result.remainingCycleSlots).toBe(0);
    expect(result.boardingAllowed).toBe(true);
  });

  test('ciclos ya terminados conservan historia sin ofrecer ventana de venta', () => {
    const result = calculateWindow(input({ now: '2026-12-11T05:00:00Z' }));
    expect(result.cycles).toHaveLength(2);
    expect(result.confirmedFromInclusive).toBeNull();
    expect(result.confirmedThroughExclusive).toBeNull();
    expect(result.boardingAllowed).toBe(false);
    expect(result.boardingCycleId).toBeNull();
  });

  test('rechaza períodos duplicados aunque tengan IDs distintos', () => {
    expect(() =>
      calculateWindow(input({ cycles: [cycle('a', '2026-11-01'), cycle('b', '2026-11-01')] })),
    ).toThrow(expect.objectContaining({ code: 'ROUTE_CYCLE_SEQUENCE_CONFLICT' }));
  });

  test('rechaza un elemento hueco en el historial', () => {
    const cycles = [];
    cycles.length = 1;
    expect(() => calculateWindow(input({ cycles }))).toThrow(RouteProgrammingValidationError);
  });

  test('incluye la base en dos ciclos y termina después de 40 días exclusivos', () => {
    const result = calculateWindow(input());
    expect(result).toMatchObject({
      confirmedFromInclusive: '2026-11-01T05:00:00.000Z',
      confirmedThroughExclusive: '2026-12-11T05:00:00.000Z',
      boardingAllowed: true,
      boardingCycleId: 'original-2',
      remainingCycleSlots: 0,
      renewalAllowed: false,
    });
  });

  test('no depende de hoy para extender la ventana', () => {
    const first = calculateWindow(input());
    const second = calculateWindow(input({ now: '2026-11-15T15:00:00Z' }));
    expect(second.confirmedThroughExclusive).toBe(first.confirmedThroughExclusive);
    expect(calculateWindow(input({ boardingAt: '2026-12-11T05:00:00Z' })).boardingAllowed).toBe(
      false,
    );
  });

  test('solo el primer ciclo confirmado habilita ventas si el segundo está en borrador', () => {
    const value = input();
    value.cycles[1].status = 'DRAFT';
    const result = calculateWindow(value);
    expect(result.confirmedThroughExclusive).toBe('2026-11-21T05:00:00.000Z');
    expect(result.boardingAllowed).toBe(false);
    expect(result.boardingCycleId).toBe(null);
  });

  test.each([[], [cycle('base', '2026-11-01', 'DRAFT')]].map((cycles) => ({ cycles })))(
    'sin confirmación no vende: %j',
    ({ cycles }) => {
      const result = calculateWindow(input({ cycles }));
      expect(result.confirmedFromInclusive).toBeNull();
      expect(result.confirmedThroughExclusive).toBeNull();
      expect(result.boardingAllowed).toBe(false);
    },
  );

  test('inicio inclusivo con reloj anterior; fin exclusivo; cierre exacto al embarque', () => {
    const boardingAt = '2026-11-01T00:00:00-05:00';
    expect(
      calculateWindow(input({ boardingAt, now: '2026-10-31T23:59:59.999-05:00' })).boardingAllowed,
    ).toBe(true);
    expect(calculateWindow(input({ boardingAt, now: boardingAt })).boardingAllowed).toBe(false);
    expect(
      calculateWindow(
        input({ boardingAt: '2026-10-31T23:59:59-05:00', now: '2026-10-30T00:00:00Z' }),
      ).boardingAllowed,
    ).toBe(false);
    expect(
      calculateWindow(input({ boardingAt: '2026-12-11T00:00:00-05:00' })).boardingAllowed,
    ).toBe(false);
  });

  test('el punto en frontera pertenece al segundo ciclo confirmado', () => {
    const result = calculateWindow(input({ boardingAt: '2026-11-21T00:00:00-05:00' }));
    expect(result.boardingCycleId).toBe('original-2');
    expect(result.boardingAllowed).toBe(true);
  });

  test('renovar requiere liberar un período y no crea ni renumera historia', () => {
    const before = input({ now: '2026-11-20T23:59:59.999-05:00' });
    expect(calculateWindow(before).renewalAllowed).toBe(false);
    const onEnd = input({ now: '2026-11-21T00:00:00-05:00' });
    const previous = JSON.stringify(onEnd);
    const result = calculateWindow(onEnd);
    expect(result.renewalAllowed).toBe(true);
    expect(result.remainingCycleSlots).toBe(1);
    expect(result.nextCycleStartAt).toBe('2026-12-11T05:00:00.000Z');
    expect(JSON.stringify(onEnd)).toBe(previous);
    expect(result.cycles.map(({ id }) => id)).toEqual(['original-1', 'original-2']);
    expect(calculateWindow(onEnd).confirmedThroughExclusive).toBe(result.confirmedThroughExclusive);
  });

  test('historia y dos ciclos pendientes conservan IDs sin habilitar un tercero', () => {
    const value = input({ now: '2026-11-21T00:00:00-05:00' });
    value.cycles.push(cycle('renovado-3', '2026-12-11'));
    const result = calculateWindow(value);
    expect(result.cycles.map(({ id }) => id)).toEqual(['original-1', 'original-2', 'renovado-3']);
    expect(result.renewalAllowed).toBe(false);
    expect(result.remainingCycleSlots).toBe(0);
    expect(result.confirmedThroughExclusive).toBe('2026-12-31T05:00:00.000Z');
  });

  test('más de dos no terminados se rechaza aunque el tercero sea borrador', () => {
    const value = input();
    value.cycles.push(cycle('tercero', '2026-12-11', 'DRAFT'));
    expect(() => calculateWindow(value)).toThrow(
      expect.objectContaining({ code: 'ROUTE_CYCLE_LIMIT_EXCEEDED' }),
    );
  });

  test('no ofrece renovación si primero debe confirmar un borrador existente', () => {
    const value = input({ now: '2026-11-21T00:00:00-05:00' });
    value.cycles[1].status = 'DRAFT';
    expect(calculateWindow(value).renewalAllowed).toBe(false);
  });

  test.each(
    [
      [cycle('base', '2026-11-01', 'DRAFT'), cycle('siguiente', '2026-11-21')],
      [cycle('base', '2026-11-01'), cycle('siguiente', '2026-11-22')],
      [cycle('base', '2026-11-01'), cycle('siguiente', '2026-11-20')],
      [cycle('siguiente', '2026-11-21')],
    ].map((cycles) => ({ cycles })),
  )('rechaza secuencia interrumpida o solapada %j', ({ cycles }) => {
    expect(() => calculateWindow(input({ cycles }))).toThrow(RouteProgrammingConflictError);
  });

  test('listas desordenadas no alteran resultado ni entradas', () => {
    const value = input();
    value.cycles.reverse();
    const result = calculateWindow(value);
    expect(result).toEqual(calculateWindow(input()));
    expect(value.cycles[0].id).toBe('original-2');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.cycles)).toBe(true);
    expect(Object.isFrozen(result.cycles[0])).toBe(true);
    value.cycles[0].id = 'alterado';
    expect(result.cycles[1].id).toBe('original-2');
  });

  test.each(['cooperativeId', 'busGroupId'])('rechaza ciclo con %s ajeno', (field) => {
    const value = input();
    value.cycles[0][field] = 'otro';
    expect(() => calculateWindow(value)).toThrow(RouteProgrammingValidationError);
  });

  test.each([
    undefined,
    null,
    [],
    {},
    input({ cycles: null }),
    input({ cycles: [null] }),
    input({ cooperativeId: '' }),
    input({ busGroupId: '' }),
    input({ cycleLengthDays: 0 }),
  ])('rechaza entrada inválida %#', (value) => {
    expect(() => calculateWindow(value)).toThrow(RouteProgrammingValidationError);
  });

  test.each(['now', 'boardingAt'])('exige fecha y zona explícita para %s', (field) => {
    expect(() => calculateWindow(input({ [field]: '2026-11-01T00:00:00' }))).toThrow();
  });

  test.each([{ status: 'CONFIRMED' }, { id: '' }, { startDate: '2026-11-31' }])(
    'rechaza ciclo inválido %j',
    (change) => {
      const value = input();
      Object.assign(value.cycles[0], change);
      expect(() => calculateWindow(value)).toThrow();
    },
  );

  test('rechaza ID de ciclo repetido incluso con fechas consecutivas', () => {
    const value = input();
    value.cycles[1].id = value.cycles[0].id;
    expect(() => calculateWindow(value)).toThrow(RouteProgrammingValidationError);
  });

  test('errores conservan contrato de dominio', () => {
    expect(new RouteProgrammingValidationError('Datos inválidos')).toMatchObject({
      code: 'ROUTE_PROGRAMMING_INVALID',
      httpStatus: 400,
      name: 'RouteProgrammingValidationError',
    });
    expect(new RouteProgrammingConflictError('CONFLICT', 'Conflicto')).toMatchObject({
      code: 'CONFLICT',
      httpStatus: 409,
      name: 'RouteProgrammingConflictError',
    });
  });
});
