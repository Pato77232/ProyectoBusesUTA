const { randomUUID } = require('node:crypto');
const factory = require('../../../../src/modules/route-sheets/application/use-cases/get-route-sheet-editor.use-case');
const routeSheetId = randomUUID(),
  cooperativeId = randomUUID(),
  busGroupId = randomUUID(),
  frequencyId = randomUUID();
let dependencies, snapshot, frequency;
beforeEach(() => {
  snapshot = {
    sheet: { id: routeSheetId, cooperativeId, busGroupId },
    programming: { programming: null },
    tariff: { tariff: null },
  };
  frequency = {
    id: frequencyId,
    cooperativeId,
    origin: 'Ambato',
    destination: 'Quito',
    departureTime: '07:00',
    antResolutionNumber: 'ANT-QA',
    status: 'ACTIVE',
    stops: [],
  };
  dependencies = {
    editorRepository: { findSnapshot: jest.fn(async () => snapshot) },
    busQueryPort: {
      findByBusGroupId: jest.fn(async () => [
        {
          id: randomUUID(),
          cooperativeId,
          busGroupId,
          plate: 'TBM-0901',
          unitNumber: 1,
          vin: 'no-exponer',
        },
      ]),
    },
    busGroupQueryPort: {
      findById: jest.fn(async () => ({
        id: busGroupId,
        cooperative_id: cooperativeId,
        name: 'Grupo QA',
      })),
    },
    frequencyQueryPort: {
      findActiveByCooperativeId: jest.fn(async () => [frequency]),
      findWithStops: jest.fn(async () => frequency),
    },
  };
});
test('obtiene catálogos públicos después del snapshot y no expone VIN ni fotos', async () => {
  const result = await factory(dependencies)({ routeSheetId, cooperativeId });
  expect(result.sheet.busGroupName).toBe('Grupo QA');
  expect(result.buses[0].vin).toBeUndefined();
  expect(dependencies.busQueryPort.findByBusGroupId).toHaveBeenCalledWith(
    busGroupId,
    cooperativeId,
  );
  expect(dependencies.editorRepository.findSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
    dependencies.busGroupQueryPort.findById.mock.invocationCallOrder[0],
  );
});
test('incluye frecuencia inactiva referenciada sin inventar que esté activa', async () => {
  snapshot.programming.programming = { requiredServices: [{ frequencyId }] };
  frequency.status = 'INACTIVE';
  dependencies.frequencyQueryPort.findActiveByCooperativeId.mockResolvedValue([]);
  expect((await factory(dependencies)({ routeSheetId, cooperativeId })).frequencies[0].status).toBe(
    'INACTIVE',
  );
});
test('provider ajeno o sin identidad válida falla cerrado', async () => {
  dependencies.busQueryPort.findByBusGroupId.mockResolvedValue([
    { id: randomUUID(), cooperativeId: randomUUID(), busGroupId, plate: 'TBM-0901', unitNumber: 1 },
  ]);
  await expect(factory(dependencies)({ routeSheetId, cooperativeId })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_SOURCE_UNAVAILABLE',
  });
});
test('frecuencia referenciada ausente no se convierte en lista vacía', async () => {
  snapshot.tariff.tariff = { frequencies: [{ frequencyId }] };
  dependencies.frequencyQueryPort.findWithStops.mockResolvedValue(null);
  await expect(factory(dependencies)({ routeSheetId, cooperativeId })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_SOURCE_UNAVAILABLE',
  });
});
test('propaga fallo técnico sin ocultarlo como catálogo vacío', async () => {
  const failure = new Error('fallo QA');
  dependencies.busQueryPort.findByBusGroupId.mockRejectedValue(failure);
  await expect(factory(dependencies)({ routeSheetId, cooperativeId })).rejects.toBe(failure);
});
