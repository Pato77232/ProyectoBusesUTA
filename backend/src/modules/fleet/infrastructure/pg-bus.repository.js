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
}

module.exports = PgBusRepository;
