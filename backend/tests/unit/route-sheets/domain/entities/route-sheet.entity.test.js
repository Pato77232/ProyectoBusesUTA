const RouteSheet = require('../../../../../src/modules/route-sheets/domain/entities/route-sheet');
const RouteSheetStatus = require('../../../../../src/modules/route-sheets/domain/value-objects/route-sheet-status');
const { RouteSheetNotEditableError } = require('../../../../../src/modules/route-sheets/domain/errors/route-sheet-errors');

describe('Entidad RouteSheet', () => {
  test('crea hoja de ruta en DRAFT por defecto', () => {
    const routeSheet = new RouteSheet({
      id: 'rs-1',
      cooperativeId: 'coop-1',
      busGroupId: 'bg-1',
      routeDate: '2026-10-25',
    });
    expect(routeSheet.status.isDraft()).toBe(true);
    expect(routeSheet.isEditable()).toBe(true);
    expect(routeSheet.cooperativeId).toBe('coop-1');
    expect(routeSheet.busGroupId).toBe('bg-1');
  });

  test('publica hoja de ruta desde DRAFT', () => {
    const routeSheet = new RouteSheet({
      id: 'rs-1',
      cooperativeId: 'coop-1',
      busGroupId: 'bg-1',
      routeDate: '2026-10-25',
    });
    routeSheet.publish('user-1');
    expect(routeSheet.status.isPublished()).toBe(true);
    expect(routeSheet.isEditable()).toBe(false);
    expect(routeSheet.publishedBy).toBe('user-1');
    expect(routeSheet.publishedAt).toBeInstanceOf(Date);
  });

  test('rechaza publicar desde estado no editable', () => {
    const routeSheet = new RouteSheet({
      id: 'rs-1',
      cooperativeId: 'coop-1',
      busGroupId: 'bg-1',
      routeDate: '2026-10-25',
      status: RouteSheetStatus.published(),
    });
    expect(() => routeSheet.publish('user-1')).toThrow(RouteSheetNotEditableError);
  });

  test('assertEditable lanza error si no es editable', () => {
    const routeSheet = new RouteSheet({
      id: 'rs-1',
      cooperativeId: 'coop-1',
      busGroupId: 'bg-1',
      routeDate: '2026-10-25',
      status: RouteSheetStatus.published(),
    });
    expect(() => routeSheet.assertEditable()).toThrow(RouteSheetNotEditableError);
  });

  test('requiere cooperativeId y busGroupId', () => {
    expect(() => new RouteSheet({ busGroupId: 'bg-1', routeDate: '2026-10-25' })).toThrow('El ID de la cooperativa es obligatorio.');
    expect(() => new RouteSheet({ cooperativeId: 'coop-1', routeDate: '2026-10-25' })).toThrow('El grupo de buses es obligatorio.');
    expect(() => new RouteSheet({ cooperativeId: 'coop-1', busGroupId: 'bg-1' })).toThrow('La fecha de la hoja de ruta es obligatoria.');
  });
});
