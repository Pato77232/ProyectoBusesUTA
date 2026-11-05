const { randomUUID } = require('node:crypto');
const BusRepository = require('../domain/bus.repository');
const {
  createBusRegistrationData,
  formatBusPlate,
  assertBusGroupOwnership,
} = require('../domain/bus-registration');
const { createBusSeatConfiguration } = require('../domain/bus-seat-configuration');
const { createBusPhotoReferences } = require('../domain/bus-photo-references');
const {
  BusAlreadyExistsError,
  BusRegistrationCommitUnknownError,
} = require('../domain/bus-registration-error');

const BUS_UNIQUE_CONSTRAINTS = [
  'buses_plate_unique',
  'buses_vin_unique',
  'buses_cooperative_unit_unique',
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUS_SUMMARY_COLUMNS = 'id, cooperative_id, bus_group_id, plate, unit_number, capacity';

const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

async function insertBus(client, request) {
  const { id, cooperativeId, data, configuration } = request;
  const { rows } = await client.query(
    `
    INSERT INTO buses (id, cooperative_id, bus_group_id, plate, vin, unit_number,
      bodywork_brand, color, seat_layout_id, seat_layout_version, seat_layout_snapshot, capacity)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12) RETURNING *`,
    [
      id,
      cooperativeId,
      data.busGroupId,
      data.plate,
      data.vin,
      data.unitNumber,
      data.bodyworkBrand,
      data.color,
      data.seatLayoutId,
      data.seatLayoutVersion,
      JSON.stringify(configuration.layout),
      configuration.capacity,
    ],
  );
  return rows[0];
}

async function insertSeats(client, request, newId) {
  const { id, cooperativeId, configuration } = request;
  const seats = configuration.seats.map((seat) => ({
    id: newId(),
    layout_seat_key: seat.layoutSeatKey,
    label: seat.label,
    deck: seat.deck,
    row_index: seat.row,
    column_index: seat.column,
    category: seat.category,
    offered: seat.offered,
  }));
  await client.query(
    `
    INSERT INTO bus_seats (id, bus_id, cooperative_id, layout_seat_key, label, deck,
      row_index, column_index, category, offered)
    SELECT s.id, $1, $2, s.layout_seat_key, s.label, s.deck, s.row_index, s.column_index, s.category, s.offered
    FROM jsonb_to_recordset($3::jsonb) AS s(id uuid, layout_seat_key text, label integer,
      deck integer, row_index integer, column_index integer, category text, offered boolean)`,
    [id, cooperativeId, JSON.stringify(seats)],
  );
}

async function insertPhotos(client, request) {
  const photos = request.photos.map((photo) => ({
    storage_key: photo.fileKey,
    content_type: photo.contentType,
    size: photo.size,
    sort_order: photo.order,
  }));
  const { rows } = await client.query(
    `
    INSERT INTO bus_photos (bus_id, cooperative_id, storage_key, content_type, size, sort_order)
    SELECT $1, $2, p.storage_key, p.content_type, p.size, p.sort_order
    FROM jsonb_to_recordset($3::jsonb) AS p(storage_key uuid, content_type text, size integer, sort_order integer)
    RETURNING id, content_type, size, sort_order`,
    [request.id, request.cooperativeId, JSON.stringify(photos)],
  );
  return rows
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((photo) => ({
      id: photo.id,
      contentType: photo.content_type,
      size: photo.size,
      order: photo.sort_order,
    }));
}

function presentBus(row, photos) {
  return {
    id: row.id,
    plate: formatBusPlate(row.plate),
    vin: row.vin,
    unitNumber: Number(row.unit_number),
    bodyworkBrand: row.bodywork_brand,
    color: row.color,
    busGroupId: row.bus_group_id,
    seatLayoutId: row.seat_layout_id,
    seatLayoutVersion: row.seat_layout_version,
    capacity: row.capacity,
    photos,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function presentBusSeat(row) {
  return {
    seatId: row.seat_id,
    layoutSeatKey: row.layout_seat_key,
    label: row.label,
    deck: row.deck,
    row: row.row_index,
    column: row.column_index,
    category: row.category,
    offered: row.offered,
  };
}

function presentBusSummary(row) {
  return {
    id: row.id,
    cooperativeId: row.cooperative_id,
    busGroupId: row.bus_group_id,
    plate: formatBusPlate(row.plate),
    unitNumber: Number(row.unit_number),
    capacity: row.capacity,
  };
}

function presentAdminBusSummary(row) {
  return {
    id: row.id,
    plate: formatBusPlate(row.plate),
    unitNumber: Number(row.unit_number),
    busGroupId: row.bus_group_id,
    busGroupName: row.bus_group_name,
    capacity: row.capacity,
    photoCount: row.photo_count,
  };
}

function presentAdminBusDetails(row, seats, photos) {
  return {
    id: row.id,
    plate: formatBusPlate(row.plate),
    vin: row.vin,
    unitNumber: Number(row.unit_number),
    bodyworkBrand: row.bodywork_brand,
    color: row.color,
    busGroup: { id: row.bus_group_id, name: row.bus_group_name },
    seatLayout: {
      id: row.seat_layout_id,
      version: row.seat_layout_version,
      snapshot: row.seat_layout_snapshot,
    },
    capacity: row.capacity,
    seats: seats.map(presentBusSeat),
    photos: photos.map((photo) => ({
      id: photo.id,
      contentType: photo.content_type,
      size: photo.size,
      order: photo.sort_order,
    })),
  };
}

class PgBusRepository extends BusRepository {
  constructor(pool, { newId = randomUUID } = {}) {
    super();
    this.pool = pool;
    this.newId = newId;
  }

  async create(input, { beforeCommit = async () => {} } = {}) {
    const data = createBusRegistrationData(input.data);
    const request = {
      id: input.id,
      cooperativeId: input.cooperativeId,
      data,
      configuration: createBusSeatConfiguration(data, input.configuration.layout),
      photos: createBusPhotoReferences(input.photos),
    };
    const client = await this.pool.connect();
    let begun = false;
    let committing = false;
    let discardClient = false;
    try {
      await client.query('BEGIN');
      begun = true;
      const group = await client.query(
        'SELECT id, cooperative_id FROM bus_groups WHERE id=$1 AND cooperative_id=$2 FOR KEY SHARE',
        [data.busGroupId, request.cooperativeId],
      );
      assertBusGroupOwnership(group.rows[0], request.cooperativeId, data.busGroupId);
      const row = await insertBus(client, request);
      await insertSeats(client, request, this.newId);
      const response = presentBus(row, await insertPhotos(client, request));
      await beforeCommit();
      committing = true;
      await client.query('COMMIT');
      return response;
    } catch (error) {
      if (committing) {
        discardClient = true;
        throw new BusRegistrationCommitUnknownError({
          busId: request.id,
          cooperativeId: request.cooperativeId,
          cause: error,
        });
      }
      discardClient = !begun;
      if (begun) {
        try {
          await client.query('ROLLBACK');
        } catch {
          discardClient = true;
        }
      }
      if (error.code === '23505' && BUS_UNIQUE_CONSTRAINTS.includes(error.constraint)) {
        throw new BusAlreadyExistsError();
      }
      throw error;
    } finally {
      client.release(discardClient);
    }
  }

  async findById(id, cooperativeId) {
    if (!isUuid(id) || !isUuid(cooperativeId)) return null;
    const { rows } = await this.pool.query(
      `SELECT ${BUS_SUMMARY_COLUMNS} FROM buses WHERE id = $1 AND cooperative_id = $2`,
      [id, cooperativeId],
    );
    return rows[0] ? presentBusSummary(rows[0]) : null;
  }

  async listByCooperative(cooperativeId) {
    if (!isUuid(cooperativeId)) return [];
    const { rows } = await this.pool.query(
      `SELECT ${BUS_SUMMARY_COLUMNS} FROM buses WHERE cooperative_id = $1 ORDER BY unit_number`,
      [cooperativeId],
    );
    return rows.map(presentBusSummary);
  }

  async listAdminBuses(cooperativeId) {
    if (!isUuid(cooperativeId)) return [];
    const { rows } = await this.pool.query(
      `SELECT b.id, b.bus_group_id, g.name AS bus_group_name, b.plate, b.unit_number,
        b.capacity, COUNT(p.id)::int AS photo_count
       FROM buses b
       JOIN bus_groups g ON g.id = b.bus_group_id AND g.cooperative_id = b.cooperative_id
       LEFT JOIN bus_photos p ON p.bus_id = b.id AND p.cooperative_id = b.cooperative_id
       WHERE b.cooperative_id = $1
       GROUP BY b.id, b.bus_group_id, g.name, b.plate, b.unit_number, b.capacity
       ORDER BY b.unit_number, b.id`,
      [cooperativeId],
    );
    return rows.map(presentAdminBusSummary);
  }

  async findAdminDetails(id, cooperativeId) {
    if (!isUuid(id) || !isUuid(cooperativeId)) return null;
    const { rows } = await this.pool.query(
      `SELECT b.id, b.cooperative_id, b.bus_group_id, g.name AS bus_group_name, b.plate,
        b.vin, b.unit_number, b.bodywork_brand, b.color, b.seat_layout_id,
        b.seat_layout_version, b.seat_layout_snapshot, b.capacity
       FROM buses b
       JOIN bus_groups g ON g.id = b.bus_group_id AND g.cooperative_id = b.cooperative_id
       WHERE b.id = $1 AND b.cooperative_id = $2`,
      [id, cooperativeId],
    );
    const bus = rows[0];
    if (!bus) return null;
    const [seatResult, photoResult] = await Promise.all([
      this.pool.query(
        `SELECT id AS seat_id, layout_seat_key, label, deck, row_index, column_index, category, offered
         FROM bus_seats WHERE bus_id = $1 AND cooperative_id = $2
         ORDER BY deck DESC, label, id`,
        [id, cooperativeId],
      ),
      this.pool.query(
        `SELECT id, content_type, size, sort_order
         FROM bus_photos WHERE bus_id = $1 AND cooperative_id = $2 ORDER BY sort_order, id`,
        [id, cooperativeId],
      ),
    ]);
    return presentAdminBusDetails(bus, seatResult.rows, photoResult.rows);
  }

  async findPhotoById({ busId, photoId, cooperativeId }) {
    if (![busId, photoId, cooperativeId].every(isUuid)) return null;
    const { rows } = await this.pool.query(
      `SELECT storage_key, content_type, size
       FROM bus_photos
       WHERE id = $1 AND bus_id = $2 AND cooperative_id = $3`,
      [photoId, busId, cooperativeId],
    );
    const photo = rows[0];
    return photo
      ? { fileKey: photo.storage_key, contentType: photo.content_type, size: photo.size }
      : null;
  }

  async listByBusGroup(busGroupId, cooperativeId) {
    if (!isUuid(busGroupId) || !isUuid(cooperativeId)) return [];
    const { rows } = await this.pool.query(
      `SELECT ${BUS_SUMMARY_COLUMNS} FROM buses
       WHERE bus_group_id = $1 AND cooperative_id = $2 ORDER BY unit_number`,
      [busGroupId, cooperativeId],
    );
    return rows.map(presentBusSummary);
  }

  // LEFT JOIN: un bus sin asientos es una lista vacía, no un bus inexistente.
  async listSeats(busId, cooperativeId) {
    if (!isUuid(busId) || !isUuid(cooperativeId)) return null;
    const { rows } = await this.pool.query(
      `SELECT b.id AS bus_id, s.id AS seat_id, s.layout_seat_key, s.label, s.deck, s.row_index,
        s.column_index, s.category, s.offered
       FROM buses b
       LEFT JOIN bus_seats s
         ON s.bus_id = b.id AND s.cooperative_id = b.cooperative_id
       WHERE b.id = $1 AND b.cooperative_id = $2
       ORDER BY s.deck DESC, s.label`,
      [busId, cooperativeId],
    );
    if (rows.length === 0) return null;
    return {
      busId: rows[0].bus_id,
      seats: rows.filter((row) => row.seat_id !== null).map(presentBusSeat),
    };
  }
}

module.exports = PgBusRepository;
