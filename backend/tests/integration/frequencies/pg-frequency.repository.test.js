const { randomUUID } = require('node:crypto');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const PgFrequencyRepository = require('../../../src/modules/frequencies/infrastructure/pg-frequency.repository');
const { createFrequency } = require('../../../src/modules/frequencies/domain/frequency');
const {
  FrequencyAlreadyExistsError,
  FrequencyNotFoundError,
} = require('../../../src/modules/frequencies/domain/frequency-error');

let pool;
let repository;
let cooperativeId;
let anotherCooperativeId;

function anyRuc() {
  return randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7');
}

async function createCooperative(name) {
  const { rows } = await pool.query(
    'INSERT INTO cooperatives(name, ruc) VALUES ($1, $2) RETURNING id',
    [name, anyRuc()],
  );
  return rows[0].id;
}

async function createFrequencyFor(cooperative, overrides = {}) {
  return repository.create(
    cooperative,
    createFrequency({
      origin: 'Ambato',
      destination: 'Quito',
      departure_time: '14:00',
      ant_resolution_number: 'ANT-2026-000123',
      segment_prices: [8.5],
      ...overrides,
    }),
  );
}

async function countRows(table) {
  const { rows } = await pool.query(`SELECT count(*)::integer AS total FROM ${table}`);
  return rows[0].total;
}

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgFrequencyRepository(pool);
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE route_sheet_modification_logs, route_sheet_cycles, route_sheet_rest_days, route_sheet_assignments, route_sheets, bus_groups, auth_sessions, users, cooperatives, frequency_segment_prices, frequency_stops, frequencies',
  );
  cooperativeId = await createCooperative('Cooperativa de prueba');
  anotherCooperativeId = await createCooperative('Otra cooperativa');
});

afterAll(async () => {
  if (pool) await pool.end();
});

test('persiste la frecuencia con sus paradas y precios, y la devuelve en el contrato de la API', async () => {
  // Arrange
  const data = createFrequency({
    origin: 'Quito',
    destination: 'Loja',
    departure_time: '06:30',
    ant_resolution_number: 'ANT-2026-000777',
    stops: ['Latacunga', 'Riobamba', 'Cuenca'],
    segment_prices: [1.25, 2.5, 3.75, 5],
  });

  // Act
  const created = await repository.create(cooperativeId, data);

  // Assert
  expect(created).toMatchObject({
    cooperative_id: cooperativeId,
    origin: 'Quito',
    destination: 'Loja',
    departure_time: '06:30',
    ant_resolution_number: 'ANT-2026-000777',
    status: 'ACTIVE',
    stops: ['Latacunga', 'Riobamba', 'Cuenca'],
    segment_prices: [1.25, 2.5, 3.75, 5],
  });
  expect(created.id).toEqual(expect.any(String));
  expect(created.created_at).toBeInstanceOf(Date);
  expect(created.updated_at).toBeInstanceOf(Date);
  await expect(repository.findById(cooperativeId, created.id)).resolves.toEqual(created);
});

test('guarda las paradas desde la posición 1 y los tramos consecutivos desde la posición 0', async () => {
  // Arrange / Act
  const created = await createFrequencyFor(cooperativeId, {
    stops: ['Latacunga', 'Riobamba'],
    segment_prices: [1.25, 2.5, 3.75],
  });

  // Assert
  const stops = await pool.query(
    'SELECT position, place FROM frequency_stops WHERE frequency_id = $1 ORDER BY position',
    [created.id],
  );
  expect(stops.rows).toEqual([
    { position: 1, place: 'Latacunga' },
    { position: 2, place: 'Riobamba' },
  ]);
  const segmentPrices = await pool.query(
    `SELECT from_position, to_position, amount::double precision AS amount FROM frequency_segment_prices
     WHERE frequency_id = $1 ORDER BY from_position`,
    [created.id],
  );
  expect(segmentPrices.rows).toEqual([
    { from_position: 0, to_position: 1, amount: 1.25 },
    { from_position: 1, to_position: 2, amount: 2.5 },
    { from_position: 2, to_position: 3, amount: 3.75 },
  ]);
});

test('persiste una ruta directa sin paradas y con un único precio', async () => {
  // Arrange / Act
  const created = await createFrequencyFor(cooperativeId);

  // Assert
  expect(created.stops).toEqual([]);
  expect(created.segment_prices).toEqual([8.5]);
  expect(await countRows('frequency_stops')).toBe(0);
  expect(await countRows('frequency_segment_prices')).toBe(1);
});

test('devuelve la hora de salida como HH:mm y los montos como números', async () => {
  // Arrange
  const created = await createFrequencyFor(cooperativeId, { departure_time: '09:05' });

  // Act
  const found = await repository.findById(cooperativeId, created.id);

  // Assert
  expect(found.departure_time).toBe('09:05');
  expect(found.segment_prices).toEqual([8.5]);
});

test('rechaza la ruta repetida en la cooperativa con FrequencyAlreadyExistsError', async () => {
  // Arrange
  await createFrequencyFor(cooperativeId);

  // Act / Assert
  await expect(createFrequencyFor(cooperativeId)).rejects.toBeInstanceOf(
    FrequencyAlreadyExistsError,
  );
  expect(await countRows('frequencies')).toBe(1);
});

test('acepta la misma ruta en otra cooperativa: el duplicado es por cooperativa', async () => {
  // Arrange
  await createFrequencyFor(cooperativeId);

  // Act
  const created = await createFrequencyFor(anotherCooperativeId);

  // Assert
  expect(created.cooperative_id).toBe(anotherCooperativeId);
  expect(await countRows('frequencies')).toBe(2);
});

test('no deja datos parciales cuando falla la inserción de los precios de tramo', async () => {
  // Arrange
  // Se llama al repositorio con un monto que el dominio rechaza para forzar el fallo del INSERT hijo.
  const data = {
    ...createFrequency({
      origin: 'Ambato',
      destination: 'Quito',
      departure_time: '14:00',
      ant_resolution_number: 'ANT-2026-000123',
      segment_prices: [8.5],
    }),
    segment_prices: [0],
  };

  // Act / Assert
  await expect(repository.create(cooperativeId, data)).rejects.toMatchObject({
    constraint: 'frequency_segment_prices_amount_check',
  });
  expect(await countRows('frequencies')).toBe(0);
  expect(await countRows('frequency_segment_prices')).toBe(0);
});

test('lanza FrequencyNotFoundError con un id inexistente o mal formado', async () => {
  // Arrange
  await createFrequencyFor(cooperativeId);

  // Act / Assert
  await expect(repository.findById(cooperativeId, randomUUID())).rejects.toBeInstanceOf(
    FrequencyNotFoundError,
  );
  await expect(repository.findById(cooperativeId, 'no-es-un-uuid')).rejects.toBeInstanceOf(
    FrequencyNotFoundError,
  );
  await expect(
    repository.updateStatus(cooperativeId, 'no-es-un-uuid', 'INACTIVE'),
  ).rejects.toBeInstanceOf(FrequencyNotFoundError);
});

test('no lee ni modifica las frecuencias de otra cooperativa (RN-02)', async () => {
  // Arrange
  const created = await createFrequencyFor(cooperativeId);

  // Act / Assert
  await expect(repository.findById(anotherCooperativeId, created.id)).rejects.toBeInstanceOf(
    FrequencyNotFoundError,
  );
  await expect(
    repository.updateStatus(anotherCooperativeId, created.id, 'INACTIVE'),
  ).rejects.toBeInstanceOf(FrequencyNotFoundError);
  await expect(repository.list(anotherCooperativeId)).resolves.toEqual([]);
  const { rows } = await pool.query('SELECT status FROM frequencies WHERE id = $1', [created.id]);
  expect(rows[0].status).toBe('ACTIVE');
});

test('lista solo las frecuencias de la cooperativa', async () => {
  // Arrange
  const own = await createFrequencyFor(cooperativeId);
  await createFrequencyFor(anotherCooperativeId, { origin: 'Cuenca', destination: 'Loja' });

  // Act
  const frequencies = await repository.list(cooperativeId);

  // Assert
  expect(frequencies.map((frequency) => frequency.id)).toEqual([own.id]);
});

test('lista con los filtros status, origin y destination combinados', async () => {
  // Arrange
  await createFrequencyFor(cooperativeId);
  const inactive = await createFrequencyFor(cooperativeId, {
    origin: 'Quito',
    destination: 'Loja',
    departure_time: '08:00',
  });
  await repository.updateStatus(cooperativeId, inactive.id, 'INACTIVE');

  // Act / Assert
  await expect(repository.list(cooperativeId, {})).resolves.toHaveLength(2);
  await expect(repository.list(cooperativeId, { status: 'INACTIVE' })).resolves.toEqual([
    expect.objectContaining({ id: inactive.id }),
  ]);
  // La comparación de lugares ignora espacios exteriores y mayúsculas (FREQ-01 §6).
  await expect(repository.list(cooperativeId, { origin: ' ambato ' })).resolves.toHaveLength(1);
  await expect(
    repository.list(cooperativeId, { status: 'INACTIVE', origin: 'QUITO', destination: 'loja ' }),
  ).resolves.toEqual([expect.objectContaining({ id: inactive.id })]);
  await expect(
    repository.list(cooperativeId, { status: 'ACTIVE', origin: 'Quito' }),
  ).resolves.toEqual([]);
});

test('lista las frecuencias en un orden estable por ruta y hora', async () => {
  // Arrange
  await createFrequencyFor(cooperativeId, {
    origin: 'Quito',
    destination: 'Loja',
    departure_time: '08:00',
  });
  await createFrequencyFor(cooperativeId, { departure_time: '14:00' });
  await createFrequencyFor(cooperativeId, { departure_time: '06:00' });

  // Act
  const frequencies = await repository.list(cooperativeId);

  // Assert
  expect(frequencies.map(({ origin, departure_time }) => [origin, departure_time])).toEqual([
    ['Ambato', '06:00'],
    ['Ambato', '14:00'],
    ['Quito', '08:00'],
  ]);
});

test('cambia el estado, lo persiste y devuelve la frecuencia completa (RN-23)', async () => {
  // Arrange
  const created = await createFrequencyFor(cooperativeId, {
    stops: ['Latacunga'],
    segment_prices: [1.25, 2.5],
  });

  // Act
  const updated = await repository.updateStatus(cooperativeId, created.id, 'INACTIVE');

  // Assert
  expect(updated).toMatchObject({
    id: created.id,
    status: 'INACTIVE',
    stops: ['Latacunga'],
    segment_prices: [1.25, 2.5],
  });
  await expect(repository.findById(cooperativeId, created.id)).resolves.toMatchObject({
    status: 'INACTIVE',
  });
});

test('cambiar el estado de una frecuencia ya inactiva es idempotente', async () => {
  // Arrange
  const created = await createFrequencyFor(cooperativeId);
  await repository.updateStatus(cooperativeId, created.id, 'INACTIVE');

  // Act
  const updated = await repository.updateStatus(cooperativeId, created.id, 'INACTIVE');

  // Assert
  expect(updated.status).toBe('INACTIVE');
  expect(await countRows('frequencies')).toBe(1);
});

test('dos creaciones simultáneas de la misma ruta: una sola gana y la otra recibe duplicado', async () => {
  // Arrange
  const data = createFrequency({
    origin: 'Ambato',
    destination: 'Quito',
    departure_time: '14:00',
    ant_resolution_number: 'ANT-2026-000123',
    segment_prices: [8.5],
  });

  // Act
  const results = await Promise.allSettled([
    repository.create(cooperativeId, data),
    repository.create(cooperativeId, data),
  ]);

  // Assert
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const rejected = results.find((result) => result.status === 'rejected');
  expect(rejected.reason).toBeInstanceOf(FrequencyAlreadyExistsError);
  expect(await countRows('frequencies')).toBe(1);
});
