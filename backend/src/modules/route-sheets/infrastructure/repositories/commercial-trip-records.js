const { CommercialTripSourceError } = require('../../domain/errors/commercial-trip-errors');
const iso = (value) => new Date(value).toISOString();

async function listCommercialSeries(client, { cooperativeId, busGroupId }) {
  const { rows } = await client.query(
    `SELECT s.id,s.base_start_at,s.cycle_length_days,c.cycle_number,c.start_at,c.end_exclusive,r.status
    FROM route_sheet_commercial_series s LEFT JOIN route_sheet_commercial_cycles c ON c.series_id=s.id AND c.cooperative_id=s.cooperative_id
    LEFT JOIN route_sheets r ON r.id=c.route_sheet_id AND r.cooperative_id=c.cooperative_id
    WHERE s.cooperative_id=$1 AND s.bus_group_id=$2 ORDER BY s.base_start_at,s.id,c.cycle_number`,
    [cooperativeId, busGroupId],
  );
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row.id))
      result.set(row.id, {
        id: row.id,
        baseStartAt: iso(row.base_start_at),
        cycleLengthDays: row.cycle_length_days,
        cycles: [],
      });
    if (row.cycle_number !== null)
      result.get(row.id).cycles.push({
        cycleNumber: row.cycle_number,
        startAt: iso(row.start_at),
        endExclusive: iso(row.end_exclusive),
        status: row.status,
      });
  }
  return [...result.values()];
}

async function readCommercialManifest(client, { routeSheetId, cooperativeId }) {
  const { rows } = await client.query(
    `SELECT c.*,r.tariff_frozen_revision,p.revision AS current_programming_revision,
      (SELECT count(*)::int FROM route_sheet_assignments a WHERE a.route_sheet_id=c.route_sheet_id AND a.cooperative_id=c.cooperative_id AND a.required_service_id IS NOT NULL) AS required_count
    FROM route_sheet_commercial_cycles c JOIN route_sheets r ON r.id=c.route_sheet_id AND r.cooperative_id=c.cooperative_id
    LEFT JOIN route_sheet_programmings p ON p.route_sheet_id=c.route_sheet_id AND p.cooperative_id=c.cooperative_id
    WHERE c.route_sheet_id=$1 AND c.cooperative_id=$2`,
    [routeSheetId, cooperativeId],
  );
  const cycle = rows[0];
  if (!cycle) return null;
  const { rows: trips } = await client.query(
    'SELECT id FROM route_sheet_trips WHERE route_sheet_id=$1 AND cooperative_id=$2 ORDER BY departure_at,id',
    [routeSheetId, cooperativeId],
  );
  if (
    !trips.length ||
    trips.length !== cycle.required_count ||
    cycle.programming_revision !== cycle.current_programming_revision ||
    cycle.tariff_revision !== cycle.tariff_frozen_revision
  )
    throw new CommercialTripSourceError();
  return {
    seriesId: cycle.series_id,
    cycleId: cycle.id,
    cycleNumber: cycle.cycle_number,
    tripIds: trips.map((row) => row.id),
  };
}

async function writeCommercialPublication(
  client,
  context,
  sheet,
  { programmingRecord, cycle, inventories },
) {
  const { routeSheetId, cooperativeId, modifiedBy } = context;
  const programming = programmingRecord.programming;
  let seriesId = cycle.seriesId;
  if (!seriesId)
    seriesId = (
      await client.query(
        `INSERT INTO route_sheet_commercial_series(cooperative_id,bus_group_id,base_route_sheet_id,base_start_at,cycle_length_days,created_by)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          cooperativeId,
          sheet.bus_group_id,
          routeSheetId,
          cycle.baseStartAt,
          cycle.cycleLengthDays,
          modifiedBy,
        ],
      )
    ).rows[0].id;
  const cycleId = (
    await client.query(
      `INSERT INTO route_sheet_commercial_cycles(route_sheet_id,cooperative_id,series_id,cycle_number,start_at,end_exclusive,programming_revision,tariff_revision,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        routeSheetId,
        cooperativeId,
        seriesId,
        cycle.cycleNumber,
        programming.startAt,
        programming.endExclusive,
        programmingRecord.revision,
        sheet.tariff_revision,
        modifiedBy,
      ],
    )
  ).rows[0].id;
  const inventoryIds = new Map();
  for (const inventory of inventories) {
    const row = (
      await client.query(
        `INSERT INTO route_sheet_commercial_inventories(route_sheet_id,cooperative_id,bus_id,revision,schema_version,snapshot,captured_by)
      VALUES($1,$2,$3,1,1,$4::jsonb,$5) RETURNING id`,
        [routeSheetId, cooperativeId, inventory.busId, JSON.stringify(inventory), modifiedBy],
      )
    ).rows[0];
    inventoryIds.set(inventory.busId, row.id);
  }
  const tripIds = [];
  for (const agenda of programming.agendas)
    for (const activity of agenda.activities.filter((a) => a.kind === 'SERVICE')) {
      const row = (
        await client.query(
          `INSERT INTO route_sheet_trips(cooperative_id,route_sheet_id,assignment_id,required_service_id,frequency_id,bus_id,cycle_id,inventory_snapshot_id,
        programming_revision,tariff_revision,departure_at,arrival_at,route_points,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14) RETURNING id`,
          [
            cooperativeId,
            routeSheetId,
            activity.id,
            activity.requiredServiceId,
            activity.frequencyId,
            agenda.busId,
            cycleId,
            inventoryIds.get(agenda.busId),
            programmingRecord.revision,
            sheet.tariff_revision,
            activity.departureAt,
            activity.arrivalAt,
            JSON.stringify(activity.points),
            modifiedBy,
          ],
        )
      ).rows[0];
      tripIds.push(row.id);
    }
  const manifest = { seriesId, cycleId, cycleNumber: cycle.cycleNumber, tripIds };
  await client.query(
    `INSERT INTO route_sheet_modification_logs(route_sheet_id,cooperative_id,bus_group_id,modified_by,reason,action,affected_entity,entity_id,new_value)
    VALUES($1,$2,$3,$4,'Captura comercial al publicar','COMMERCIAL_CAPTURE','TRIPS',$1,$5::jsonb)`,
    [routeSheetId, cooperativeId, sheet.bus_group_id, modifiedBy, JSON.stringify(manifest)],
  );
  // Mismo orden estable que la lectura idempotente.
  manifest.tripIds = (
    await client.query(
      'SELECT id FROM route_sheet_trips WHERE route_sheet_id=$1 AND cooperative_id=$2 ORDER BY departure_at,id',
      [routeSheetId, cooperativeId],
    )
  ).rows.map((row) => row.id);
  return manifest;
}

module.exports = { listCommercialSeries, readCommercialManifest, writeCommercialPublication };
