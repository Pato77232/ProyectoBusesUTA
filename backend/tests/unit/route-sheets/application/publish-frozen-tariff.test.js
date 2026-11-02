const publishFactory = require('../../../../src/modules/route-sheets/application/use-cases/publish-route-sheet.use-case');
const createTariffQueries = require('../../../../src/modules/route-sheets/application/create-tariff-queries');
const {
  parseTariffRequest,
  createDraftTariff,
} = require('../../../../src/modules/route-sheets/domain/value-objects/draft-tariff');
const RouteSheet = require('../../../../src/modules/route-sheets/domain/entities/route-sheet');

const id = '10000000-0000-4000-8000-000000000001';
const otherId = '20000000-0000-4000-8000-000000000002';
const context = { routeSheetId: id, cooperativeId: id, publishedBy: id };
function draft() {
  return createDraftTariff(
    parseTariffRequest({
      expectedRevision: 0,
      policy: {
        vipSurchargeBps: 2500,
        minorDiscountBps: 5000,
        seniorDiscountBps: 5000,
        disabilityDiscountBps: 5000,
      },
      frequencies: [
        { frequencyId: id, prices: [{ fromPosition: 0, toPosition: 1, amountCents: 450 }] },
      ],
    }),
    new Map([[id, ['Ambato', 'Quito']]]),
  );
}

function fixture() {
  const sheet = {
    id,
    cooperative_id: id,
    bus_group_id: id,
    status: 'DRAFT',
    tariff_revision: 1,
    tariff_draft: draft(),
    tariff_frozen: null,
    tariff_frozen_revision: null,
  };
  const entity = new RouteSheet({
    id,
    cooperativeId: id,
    busGroupId: id,
    routeDate: '2026-11-02',
    status: 'PUBLISHED',
  });
  const frequencyQueryPort = {
    findWithStops: jest.fn(async () => ({
      id,
      cooperativeId: id,
      status: 'ACTIVE',
      origin: 'Ambato',
      destination: 'Quito',
      stops: [],
    })),
  };
  const freeze = jest.fn(async () => entity);
  const frequencyIds = [id];
  const toEntity = jest.fn(() => entity);
  const tariffRepository = {
    withLockedSheet: jest.fn(async (_context, operation) =>
      operation({ sheet, frequencyIds, frequencyQueryPort, freeze, toEntity }),
    ),
  };
  return {
    sheet,
    frequencyIds,
    frequencyQueryPort,
    freeze,
    toEntity,
    tariffRepository,
    publish: publishFactory({ tariffRepository }),
  };
}

describe('Publicación con copia comercial congelada', () => {
  test('revalida y congela una vez dentro del puerto transaccional', async () => {
    const f = fixture();
    const result = await f.publish({ ...context, expectedRevision: 1 });
    expect(result.status).toBe('PUBLISHED');
    expect(f.frequencyQueryPort.findWithStops).toHaveBeenCalledWith(id, id);
    expect(f.freeze).toHaveBeenCalledWith(f.sheet.tariff_draft);
    expect(f.tariffRepository.withLockedSheet.mock.calls[0][0]).toEqual({
      routeSheetId: id,
      cooperativeId: id,
      modifiedBy: id,
    });
  });

  test('conserva la publicación sin body tomando revisión bajo bloqueo', async () => {
    const f = fixture();
    await expect(f.publish(context)).resolves.toMatchObject({ status: 'PUBLISHED' });
  });

  test('repetir publicación no consulta fuentes mutables ni genera otra copia', async () => {
    const f = fixture();
    f.sheet.status = 'PUBLISHED';
    f.sheet.tariff_frozen = draft();
    f.sheet.tariff_frozen_revision = 1;
    await expect(f.publish({ ...context, expectedRevision: 1 })).resolves.toMatchObject({
      status: 'PUBLISHED',
    });
    expect(f.freeze).not.toHaveBeenCalled();
    expect(f.frequencyQueryPort.findWithStops).not.toHaveBeenCalled();
    expect(f.toEntity).toHaveBeenCalledWith(f.sheet);
  });

  test.each([0, '1', -1, 1.5, null])('rechaza revisión inválida %s', async (expectedRevision) => {
    const f = fixture();
    await expect(f.publish({ ...context, expectedRevision })).rejects.toMatchObject({
      code: 'ROUTE_TARIFF_INVALID',
    });
    expect(f.freeze).not.toHaveBeenCalled();
  });

  test('revisión desactualizada no publica el precio nuevo sin aceptar', async () => {
    const f = fixture();
    f.sheet.tariff_revision = 2;
    await expect(f.publish({ ...context, expectedRevision: 1 })).rejects.toMatchObject({
      code: 'ROUTE_TARIFF_REVISION_CONFLICT',
    });
    expect(f.freeze).not.toHaveBeenCalled();
  });

  test('no permite publicar sin tarifario', async () => {
    const f = fixture();
    f.sheet.tariff_draft = null;
    f.sheet.tariff_revision = 0;
    await expect(f.publish(context)).rejects.toMatchObject({ code: 'ROUTE_TARIFF_REQUIRED' });
    expect(f.freeze).not.toHaveBeenCalled();
  });

  test('una hoja histórica publicada sin copia no reconstruye precios desde borrador', async () => {
    const f = fixture();
    f.sheet.status = 'PUBLISHED';
    await expect(f.publish(context)).rejects.toMatchObject({ code: 'ROUTE_TARIFF_FROZEN_MISSING' });
    expect(f.freeze).not.toHaveBeenCalled();
  });

  test('asignaciones cambiadas impiden publicar una matriz desactualizada', async () => {
    const f = fixture();
    f.frequencyIds.push(otherId);
    await expect(f.publish(context)).rejects.toMatchObject({
      code: 'ROUTE_TARIFF_FREQUENCY_MISMATCH',
    });
    expect(f.freeze).not.toHaveBeenCalled();
  });

  test('no reinterpreta índices si cambió el recorrido', async () => {
    const f = fixture();
    f.frequencyQueryPort.findWithStops.mockResolvedValue({
      id,
      cooperativeId: id,
      status: 'ACTIVE',
      origin: 'Ambato',
      destination: 'Loja',
      stops: [],
    });
    await expect(f.publish(context)).rejects.toMatchObject({ code: 'ROUTE_TARIFF_ROUTE_CHANGED' });
    expect(f.freeze).not.toHaveBeenCalled();
  });

  test('frecuencia inactiva y fallo técnico no producen publicación parcial', async () => {
    const f = fixture();
    f.frequencyQueryPort.findWithStops.mockResolvedValue({
      id,
      cooperativeId: id,
      status: 'INACTIVE',
      origin: 'Ambato',
      destination: 'Quito',
      stops: [],
    });
    await expect(f.publish(context)).rejects.toMatchObject({
      code: 'ROUTE_TARIFF_FREQUENCY_INACTIVE',
    });
    const error = new Error('Fallo ficticio');
    f.frequencyQueryPort.findWithStops.mockRejectedValue(error);
    await expect(f.publish(context)).rejects.toBe(error);
    expect(f.freeze).not.toHaveBeenCalled();
  });

  test('no usa publicación antigua sin el puerto transaccional requerido', async () => {
    await expect(publishFactory({})(context)).rejects.toMatchObject({
      code: 'ROUTE_TARIFF_SOURCE_UNAVAILABLE',
    });
  });
});

describe('Contrato de consulta del tarifario congelado', () => {
  function queries() {
    const row = {
      id,
      cooperative_id: id,
      bus_group_id: id,
      tariff_frozen: draft(),
      tariff_frozen_revision: 1,
      tariff_frozen_at: new Date('2026-11-02T05:00:00Z'),
    };
    const tariffRepository = { findPublishedById: jest.fn(async () => row) };
    return { row, tariffRepository, queries: createTariffQueries({ tariffRepository }) };
  }

  test('devuelve precio explícito, política y revisión en una copia inmutable', async () => {
    const f = queries();
    const result = await f.queries.findPrice({
      ...context,
      frequencyId: id,
      fromPosition: 0,
      toPosition: 1,
    });
    expect(result).toMatchObject({
      amountCents: 450,
      revision: 1,
      currency: 'USD',
      policy: { vipSurchargeBps: 2500 },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.policy)).toBe(true);
    expect(f.tariffRepository.findPublishedById).toHaveBeenCalledWith(id, id);
  });

  test('snapshot completo preserva contexto y versión sin depender de fuentes actuales', async () => {
    const f = queries();
    const result = await f.queries.findPublishedByRouteSheetId(id, id);
    expect(result).toMatchObject({ routeSheetId: id, cooperativeId: id, revision: 1 });
    expect(Object.isFrozen(result.tariff.frequencies[0].prices)).toBe(true);
  });

  test('ausencia devuelve null sin precio cero ni fallback', async () => {
    const f = queries();
    f.tariffRepository.findPublishedById.mockResolvedValue(null);
    expect(await f.queries.findPublishedByRouteSheetId(id, id)).toBeNull();
    expect(
      await f.queries.findPrice({ ...context, frequencyId: id, fromPosition: 0, toPosition: 1 }),
    ).toBeNull();
  });

  test.each([
    { frequencyId: otherId, fromPosition: 0, toPosition: 1 },
    { frequencyId: id, fromPosition: 0, toPosition: 10 },
  ])('par o frecuencia ausente devuelve null %#', async (pair) => {
    expect(await queries().queries.findPrice({ ...context, ...pair })).toBeNull();
  });

  test.each([
    { fromPosition: -1, toPosition: 1 },
    { fromPosition: 1, toPosition: 0 },
    { fromPosition: 0.5, toPosition: 1 },
    { fromPosition: 0, toPosition: '1' },
  ])('valida posiciones antes de leer %#', async (pair) => {
    const f = queries();
    await expect(
      f.queries.findPrice({ ...context, frequencyId: id, ...pair }),
    ).rejects.toMatchObject({ code: 'ROUTE_TARIFF_INVALID' });
    expect(f.tariffRepository.findPublishedById).not.toHaveBeenCalled();
  });

  test('fallos técnicos y contexto inconsistente no se transforman en ausencia', async () => {
    const f = queries();
    const error = new Error('Fallo ficticio de BD');
    f.tariffRepository.findPublishedById.mockRejectedValueOnce(error);
    await expect(f.queries.findPublishedByRouteSheetId(id, id)).rejects.toBe(error);
    f.row.cooperative_id = otherId;
    await expect(f.queries.findPublishedByRouteSheetId(id, id)).rejects.toMatchObject({
      code: 'ROUTE_TARIFF_SOURCE_UNAVAILABLE',
    });
  });

  test.each([null, {}, { ...draft(), currency: 'OTRA' }, { ...draft(), frequencies: [] }])(
    'snapshot corrupto falla cerrado %#',
    async (value) => {
      const f = queries();
      f.row.tariff_frozen = value;
      await expect(f.queries.findPublishedByRouteSheetId(id, id)).rejects.toMatchObject({
        code: 'ROUTE_TARIFF_SOURCE_UNAVAILABLE',
      });
    },
  );
});
