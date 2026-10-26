const { randomUUID } = require('node:crypto');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');

let pool;
let cooperativeId;

function anyRuc() {
  return randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7');
}

async function clean() {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE route_sheet_modification_logs, route_sheet_cycles, route_sheet_rest_days, route_sheet_assignments, route_sheets, bus_groups, auth_sessions, users, payment_proofs, cooperatives, frequency_segment_prices, frequency_stops, frequencies',
  );
}

async function createCooperative(name = 'Cooperativa de prueba') {
  const result = await pool.query(
    'INSERT INTO cooperatives(name, ruc) VALUES ($1, $2) RETURNING id',
    [name, anyRuc()],
  );
  return result.rows[0].id;
}

async function insertFrequency(overrides = {}) {
  const row = {
    cooperative_id: cooperativeId,
    origin: 'Ambato',
    destination: 'Quito',
    departure_time: '14:00',
    ant_resolution_number: 'ANT-2026-000123',
    status: 'ACTIVE',
    ...overrides,
  };
  return pool.query(
    `INSERT INTO frequencies(cooperative_id, origin, destination, departure_time, ant_resolution_number, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      row.cooperative_id,
      row.origin,
      row.destination,
      row.departure_time,
      row.ant_resolution_number,
      row.status,
    ],
  );
}

async function insertStop(frequencyId, position, place = 'Latacunga') {
  return pool.query(
    'INSERT INTO frequency_stops(frequency_id, position, place) VALUES ($1, $2, $3)',
    [frequencyId, position, place],
  );
}

async function insertSegmentPrice(frequencyId, fromPosition, toPosition, amount = '1.50') {
  return pool.query(
    'INSERT INTO frequency_segment_prices(frequency_id, from_position, to_position, amount) VALUES ($1, $2, $3, $4)',
    [frequencyId, fromPosition, toPosition, amount],
  );
}

beforeAll(() => {
  runMigration();
  pool = testPool();
});
beforeEach(async () => {
  await clean();
  cooperativeId = await createCooperative();
});
afterAll(async () => {
  if (pool) await pool.end();
});

test('una misma ruta no se repite dentro de la cooperativa pero sí existe en otra', async () => {
  // Arrange
  await expect(insertFrequency()).resolves.toMatchObject({ rowCount: 1 });
  const anotherCooperativeId = await createCooperative('Otra cooperativa');

  // Act / Assert
  await expect(insertFrequency()).rejects.toMatchObject({
    code: '23505',
    constraint: 'frequencies_cooperative_route_unique',
  });
  await expect(insertFrequency({ cooperative_id: anotherCooperativeId })).resolves.toMatchObject({
    rowCount: 1,
  });
});

test('la frecuencia exige una cooperativa existente', async () => {
  // Arrange / Act / Assert
  await expect(insertFrequency({ cooperative_id: randomUUID() })).rejects.toMatchObject({
    code: '23503',
    constraint: 'frequencies_cooperative_id_fk',
  });
});

test('rechaza estados fuera de ACTIVE e INACTIVE', async () => {
  // Arrange / Act / Assert
  await expect(insertFrequency({ status: 'CANCELLED' })).rejects.toMatchObject({
    code: '23514',
    constraint: 'frequencies_status_check',
  });
});

test('exige resolución ANT y ruta no vacías, incluso con solo espacios', async () => {
  // Arrange / Act / Assert
  await expect(insertFrequency({ ant_resolution_number: '   ' })).rejects.toMatchObject({
    code: '23514',
    constraint: 'frequencies_ant_resolution_number_check',
  });
  await expect(insertFrequency({ origin: ' ' })).rejects.toMatchObject({
    code: '23514',
    constraint: 'frequencies_origin_check',
  });
});

test('los precios de tramo exigen monto positivo y tramos consecutivos', async () => {
  // Arrange
  const { rows } = await insertFrequency();
  const frequencyId = rows[0].id;

  // Act / Assert
  await expect(insertSegmentPrice(frequencyId, 0, 1, '0.00')).rejects.toMatchObject({
    code: '23514',
    constraint: 'frequency_segment_prices_amount_check',
  });
  await expect(insertSegmentPrice(frequencyId, 0, 2)).rejects.toMatchObject({
    code: '23514',
    constraint: 'frequency_segment_prices_consecutive_positions',
  });
  await expect(insertSegmentPrice(frequencyId, 0, 1)).resolves.toMatchObject({ rowCount: 1 });
  await expect(insertSegmentPrice(frequencyId, 0, 1, '2.00')).rejects.toMatchObject({
    code: '23505',
    constraint: 'frequency_segment_prices_frequency_from_unique',
  });
});

test('las paradas no repiten posición dentro de la misma frecuencia', async () => {
  // Arrange
  const { rows } = await insertFrequency();
  const frequencyId = rows[0].id;
  await expect(insertStop(frequencyId, 1)).resolves.toMatchObject({ rowCount: 1 });

  // Act / Assert
  await expect(insertStop(frequencyId, 1, 'Riobamba')).rejects.toMatchObject({
    code: '23505',
    constraint: 'frequency_stops_frequency_position_unique',
  });
});

test('borrar la frecuencia elimina sus paradas y precios en cascada', async () => {
  // Arrange
  const { rows } = await insertFrequency();
  const frequencyId = rows[0].id;
  await insertStop(frequencyId, 1);
  await insertSegmentPrice(frequencyId, 0, 1);

  // Act
  await pool.query('DELETE FROM frequencies WHERE id = $1', [frequencyId]);

  // Assert
  expect((await pool.query('SELECT * FROM frequency_stops')).rows).toHaveLength(0);
  expect((await pool.query('SELECT * FROM frequency_segment_prices')).rows).toHaveLength(0);
});

test('la columna de montos de tramo es numeric(10,2) (FREQ-01 §5)', async () => {
  // Arrange / Act
  const { rows } = await pool.query(
    `SELECT numeric_precision, numeric_scale FROM information_schema.columns
     WHERE table_name = 'frequency_segment_prices' AND column_name = 'amount'`,
  );

  // Assert
  expect(rows).toEqual([{ numeric_precision: 10, numeric_scale: 2 }]);
});

test('los montos de tramo se redondean a dos decimales', async () => {
  // Arrange
  const { rows } = await insertFrequency();
  const frequencyId = rows[0].id;

  // Act
  await insertSegmentPrice(frequencyId, 0, 1, '2.567');

  // Assert
  const stored = await pool.query(
    'SELECT amount FROM frequency_segment_prices WHERE frequency_id = $1',
    [frequencyId],
  );
  expect(stored.rows).toEqual([{ amount: '2.57' }]);
});
