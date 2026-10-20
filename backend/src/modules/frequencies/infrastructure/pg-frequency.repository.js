const FrequencyRepository = require('../domain/frequency.repository');
const {
  FrequencyAlreadyExistsError,
  FrequencyNotFoundError,
} = require('../domain/frequency-error');

// `departure_time` se lee como `HH:mm` (contrato de la API) y no como el `HH:mm:ss` de PostgreSQL.
const FREQUENCY_COLUMNS = `id, cooperative_id, origin, destination,
  to_char(departure_time, 'HH24:MI') AS departure_time,
  ant_resolution_number, status, created_at, updated_at`;
const ROUTE_UNIQUE_CONSTRAINT = 'frequencies_cooperative_route_unique';
const UNIQUE_VIOLATION = '23505';
// Un id con formato inválido no puede existir: se trata como no encontrado (FREQ-01 §8).
const INVALID_TEXT_REPRESENTATION = '22P02';

const INSERT_FREQUENCY = `INSERT INTO frequencies(
    cooperative_id, origin, destination, departure_time, ant_resolution_number, status)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING ${FREQUENCY_COLUMNS}`;
// Las paradas se guardan desde la posición 1: las posiciones 0 y N+1 son el origen y el destino.
const INSERT_STOPS = `INSERT INTO frequency_stops(frequency_id, position, place)
  SELECT $1, ordinality::integer, place
  FROM unnest($2::text[]) WITH ORDINALITY AS stops(place, ordinality)`;
// El tramo `n` une los puntos `n` y `n+1` de [origen, ...paradas, destino].
const INSERT_SEGMENT_PRICES = `INSERT INTO frequency_segment_prices(
    frequency_id, from_position, to_position, amount)
  SELECT $1, (ordinality - 1)::integer, ordinality::integer, amount
  FROM unnest($2::numeric[]) WITH ORDINALITY AS prices(amount, ordinality)`;

function groupValues(rows, toValue) {
  const grouped = new Map();
  for (const row of rows) {
    const values = grouped.get(row.frequency_id) ?? [];
    values.push(toValue(row));
    grouped.set(row.frequency_id, values);
  }
  return grouped;
}

async function stopsByFrequency(executor, frequencyIds) {
  const { rows } = await executor.query(
    `SELECT frequency_id, place FROM frequency_stops
     WHERE frequency_id = ANY($1::uuid[]) ORDER BY frequency_id, position`,
    [frequencyIds],
  );
  return groupValues(rows, (row) => row.place);
}

async function segmentPricesByFrequency(executor, frequencyIds) {
  const { rows } = await executor.query(
    `SELECT frequency_id, amount FROM frequency_segment_prices
     WHERE frequency_id = ANY($1::uuid[]) ORDER BY frequency_id, from_position`,
    [frequencyIds],
  );
  // Los montos se devuelven como números para mantener el contrato JSON de la API.
  return groupValues(rows, (row) => Number(row.amount));
}

async function hydrate(executor, frequencies) {
  if (frequencies.length === 0) return [];
  const ids = frequencies.map((frequency) => frequency.id);
  const stops = await stopsByFrequency(executor, ids);
  const segmentPrices = await segmentPricesByFrequency(executor, ids);
  return frequencies.map(({ ...frequency }) => ({
    ...frequency,
    stops: stops.get(frequency.id) ?? [],
    segment_prices: segmentPrices.get(frequency.id) ?? [],
  }));
}

function notFoundOnInvalidId(error) {
  if (error.code === INVALID_TEXT_REPRESENTATION) throw new FrequencyNotFoundError();
  throw error;
}

/** Implementación PostgreSQL del puerto `FrequencyRepository`; toda consulta filtra por `cooperative_id` (RN-02). */
class PgFrequencyRepository extends FrequencyRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(cooperativeId, data) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(INSERT_FREQUENCY, [
        cooperativeId,
        data.origin,
        data.destination,
        data.departure_time,
        data.ant_resolution_number,
        data.status,
      ]);
      const frequencyId = rows[0].id;
      if (data.stops?.length) {
        await client.query(INSERT_STOPS, [frequencyId, data.stops]);
      }
      await client.query(INSERT_SEGMENT_PRICES, [frequencyId, data.segment_prices]);
      const [created] = await hydrate(client, rows);
      await client.query('COMMIT');
      return created;
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === UNIQUE_VIOLATION && error.constraint === ROUTE_UNIQUE_CONSTRAINT) {
        throw new FrequencyAlreadyExistsError();
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(cooperativeId, id) {
    let rows;
    try {
      ({ rows } = await this.pool.query(
        `SELECT ${FREQUENCY_COLUMNS} FROM frequencies WHERE cooperative_id = $1 AND id = $2`,
        [cooperativeId, id],
      ));
    } catch (error) {
      notFoundOnInvalidId(error);
    }
    if (rows.length === 0) throw new FrequencyNotFoundError();
    const [frequency] = await hydrate(this.pool, rows);
    return frequency;
  }

  async list(cooperativeId, filters = {}) {
    const conditions = ['cooperative_id = $1'];
    const values = [cooperativeId];
    if (filters.status) {
      values.push(filters.status);
      conditions.push(`status = $${values.length}`);
    }
    // Coincidencia exacta normalizada: sin distinguir mayúsculas ni espacios exteriores (FREQ-01 §6).
    for (const [column, value] of [
      ['origin', filters.origin],
      ['destination', filters.destination],
    ]) {
      if (value) {
        values.push(value.trim().toLowerCase());
        conditions.push(`lower(btrim(${column})) = $${values.length}`);
      }
    }
    const { rows } = await this.pool.query(
      `SELECT ${FREQUENCY_COLUMNS} FROM frequencies WHERE ${conditions.join(' AND ')}
       ORDER BY origin, destination, departure_time`,
      values,
    );
    return hydrate(this.pool, rows);
  }

  async updateStatus(cooperativeId, id, status) {
    let rows;
    try {
      ({ rows } = await this.pool.query(
        `UPDATE frequencies SET status = $3, updated_at = CURRENT_TIMESTAMP
         WHERE cooperative_id = $1 AND id = $2
         RETURNING ${FREQUENCY_COLUMNS}`,
        [cooperativeId, id, status],
      ));
    } catch (error) {
      notFoundOnInvalidId(error);
    }
    if (rows.length === 0) throw new FrequencyNotFoundError();
    const [frequency] = await hydrate(this.pool, rows);
    return frequency;
  }

  async listAllActiveByRoute(origin, destination) {
    const { rows } = await this.pool.query(
      `SELECT ${FREQUENCY_COLUMNS} FROM frequencies WHERE status = 'ACTIVE'
       AND lower(btrim(origin)) = lower(btrim($1)) AND lower(btrim(destination)) = lower(btrim($2))
       ORDER BY origin, destination, departure_time`,
      [origin, destination],
    );
    return hydrate(this.pool, rows);
  }
}

module.exports = PgFrequencyRepository;
