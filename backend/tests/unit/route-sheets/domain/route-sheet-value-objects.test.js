const RouteSheetStatus = require('../../../../src/modules/route-sheets/domain/value-objects/route-sheet-status');
const RouteDate = require('../../../../src/modules/route-sheets/domain/value-objects/route-date');
const CyclePeriod = require('../../../../src/modules/route-sheets/domain/value-objects/cycle-period');
const AntResolution = require('../../../../src/modules/route-sheets/domain/value-objects/ant-resolution');

describe('Value objects de route-sheets', () => {
  test('RouteSheetStatus crea estado DRAFT', () => {
    const status = RouteSheetStatus.draft();
    expect(status.isDraft()).toBe(true);
    expect(status.isPublished()).toBe(false);
    expect(status.toString()).toBe('DRAFT');
  });

  test('RouteSheetStatus crea estado PUBLISHED', () => {
    const status = RouteSheetStatus.published();
    expect(status.isPublished()).toBe(true);
    expect(status.isDraft()).toBe(false);
  });

  test('RouteSheetStatus rechaza estado inválido', () => {
    expect(() => new RouteSheetStatus('INVALID')).toThrow('Estado de hoja de ruta inválido.');
  });

  test('RouteDate acepta string de fecha', () => {
    const routeDate = new RouteDate('2026-10-25');
    expect(routeDate.toString()).toBe('2026-10-25');
  });

  test('RouteDate acepta Date', () => {
    const date = new Date('2026-10-25T00:00:00.000Z');
    const routeDate = new RouteDate(date);
    expect(routeDate.toDate()).toBeInstanceOf(Date);
  });

  test('RouteDate rechaza fecha inválida', () => {
    expect(() => new RouteDate('fecha-invalida')).toThrow('Fecha de hoja de ruta inválida.');
  });

  test('CyclePeriod acepta semanas positivas', () => {
    const period = new CyclePeriod(2);
    expect(period.weeks).toBe(2);
    expect(period.getDays()).toBe(14);
    expect(period.toValue()).toBe(2);
  });

  test('CyclePeriod rechaza valores inválidos', () => {
    expect(() => new CyclePeriod(0)).toThrow('La longitud del ciclo debe ser un número entero positivo.');
    expect(() => new CyclePeriod(-1)).toThrow('La longitud del ciclo debe ser un número entero positivo.');
    expect(() => new CyclePeriod(1.5)).toThrow('La longitud del ciclo debe ser un número entero positivo.');
  });

  test('AntResolution acepta resolución válida', () => {
    const resolution = new AntResolution('ANT-2026-123');
    expect(resolution.toString()).toBe('ANT-2026-123');
  });

  test('AntResolution rechaza valor vacío', () => {
    expect(() => new AntResolution('')).toThrow('La resolución ANT es obligatoria.');
    expect(() => new AntResolution(null)).toThrow('La resolución ANT es obligatoria.');
    expect(() => new AntResolution('   ')).toThrow('La resolución ANT es obligatoria.');
  });
});
