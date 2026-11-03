const configureFactory = require('../../../../src/modules/route-sheets/application/use-cases/configure-route-sheet-tariff.use-case');

const id = '10000000-0000-4000-8000-000000000001';
const context = { routeSheetId: id, cooperativeId: id, modifiedBy: id };
const body = () => ({
  expectedRevision: 0,
  policy: {
    vipSurchargeBps: 1000,
    minorDiscountBps: 5000,
    seniorDiscountBps: 5000,
    disabilityDiscountBps: 5000,
  },
  frequencies: [
    { frequencyId: id, prices: [{ fromPosition: 0, toPosition: 1, amountCents: 200 }] },
  ],
});

function fixture() {
  const save = jest.fn(async (tariff) => ({ revision: 1, tariff }));
  const sheet = { status: 'DRAFT', tariff_revision: 0 };
  const frequencyIds = [id];
  const repository = {
    withLockedSheet: jest.fn(async (_context, operation) =>
      operation({ sheet, frequencyIds, save }),
    ),
  };
  const detail = {
    id,
    cooperativeId: id,
    status: 'ACTIVE',
    origin: 'Ambato',
    destination: 'Quito',
    stops: [],
  };
  const frequencyQueryPort = { findWithStops: jest.fn(async () => detail) };
  return {
    save,
    sheet,
    frequencyIds,
    repository,
    detail,
    frequencyQueryPort,
    configure: configureFactory({ tariffRepository: repository, frequencyQueryPort }),
  };
}

describe('Configurar tarifario de hoja borrador', () => {
  test('deriva recorrido de API pública, guarda snapshot y propaga contexto', async () => {
    const f = fixture();
    const result = await f.configure({ ...context, body: body() });
    expect(f.frequencyQueryPort.findWithStops).toHaveBeenCalledWith(id, id);
    expect(f.repository.withLockedSheet.mock.calls[0][0]).toEqual(context);
    expect(result.tariff.frequencies[0].routePoints).toEqual(['Ambato', 'Quito']);
    expect(f.save).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['PUBLISHED', 0, 'ROUTE_TARIFF_NOT_EDITABLE'],
    ['DRAFT', 1, 'ROUTE_TARIFF_REVISION_CONFLICT'],
  ])('rechaza estado %s o revisión %s', async (status, revision, code) => {
    const f = fixture();
    f.sheet.status = status;
    f.sheet.tariff_revision = revision;
    await expect(f.configure({ ...context, body: body() })).rejects.toMatchObject({ code });
    expect(f.frequencyQueryPort.findWithStops).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });

  test('rechaza cuerpo inválido antes de comenzar transacción', async () => {
    const f = fixture();
    await expect(
      f.configure({ ...context, body: { ...body(), cooperativeId: id } }),
    ).rejects.toMatchObject({ code: 'ROUTE_TARIFF_INVALID' });
    expect(f.repository.withLockedSheet).not.toHaveBeenCalled();
  });

  test('no admite frecuencias ajenas a las asignaciones', async () => {
    const f = fixture();
    f.frequencyIds.length = 0;
    await expect(f.configure({ ...context, body: body() })).rejects.toMatchObject({
      code: 'ROUTE_TARIFF_FREQUENCY_MISMATCH',
    });
    expect(f.save).not.toHaveBeenCalled();
  });

  test.each([null, { cooperativeId: 'otro' }, { id: 'otro' }, { stops: null }, { origin: ' ' }])(
    'rechaza recorrido inexistente o proveedor inconsistente %#',
    async (change) => {
      const f = fixture();
      f.frequencyQueryPort.findWithStops.mockResolvedValue(
        change === null ? null : { ...f.detail, ...change },
      );
      await expect(f.configure({ ...context, body: body() })).rejects.toBeInstanceOf(Error);
      expect(f.save).not.toHaveBeenCalled();
    },
  );

  test('rechaza frecuencia inactiva', async () => {
    const f = fixture();
    f.detail.status = 'INACTIVE';
    await expect(f.configure({ ...context, body: body() })).rejects.toMatchObject({
      code: 'ROUTE_TARIFF_FREQUENCY_INACTIVE',
    });
    expect(f.save).not.toHaveBeenCalled();
  });

  test('propaga fallo técnico sin convertirlo en tarifa cero', async () => {
    const f = fixture();
    const error = new Error('Proveedor no disponible');
    f.frequencyQueryPort.findWithStops.mockRejectedValue(error);
    await expect(f.configure({ ...context, body: body() })).rejects.toBe(error);
    expect(f.save).not.toHaveBeenCalled();
  });
});
