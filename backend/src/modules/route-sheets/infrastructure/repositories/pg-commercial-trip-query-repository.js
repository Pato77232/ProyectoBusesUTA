const Port = require('../../domain/ports/commercial-trip-query-repository');
const iso = (value) =>
  value === null || value === undefined ? null : new Date(value).toISOString();

async function readSnapshot(client, tripId) {
  // Único lookup global permitido por el contrato de catálogo Q5; no incluye PII.
  const tripRow = (
    await client.query(
      `SELECT id,cooperative_id,route_sheet_id,assignment_id,required_service_id,frequency_id,bus_id,
    cycle_id,inventory_snapshot_id,programming_revision,tariff_revision,departure_at,arrival_at,route_points
    FROM route_sheet_trips WHERE id=$1`,
      [tripId],
    )
  ).rows[0];
  if (!tripRow) return null;
  const { cooperative_id: cooperativeId, route_sheet_id: routeSheetId } = tripRow;
  const pair = [routeSheetId, cooperativeId];
  const sheet = (
    await client.query(
      'SELECT id,cooperative_id,bus_group_id,status,tariff_frozen,tariff_frozen_revision FROM route_sheets WHERE id=$1 AND cooperative_id=$2',
      pair,
    )
  ).rows[0];
  const programming = (
    await client.query(
      'SELECT revision,start_at,end_exclusive FROM route_sheet_programmings WHERE route_sheet_id=$1 AND cooperative_id=$2',
      pair,
    )
  ).rows[0];
  const assignment = (
    await client.query(
      `SELECT id,required_service_id,frequency_id,bus_id,departure_at,arrival_at,preparation_minutes FROM route_sheet_assignments
    WHERE id=$1 AND route_sheet_id=$2 AND cooperative_id=$3`,
      [tripRow.assignment_id, ...pair],
    )
  ).rows[0];
  const required = (
    await client.query(
      'SELECT id,frequency_id,departure_at FROM route_sheet_required_services WHERE id=$1 AND route_sheet_id=$2 AND cooperative_id=$3',
      [tripRow.required_service_id, ...pair],
    )
  ).rows[0];
  const inventory = (
    await client.query(
      `SELECT id,bus_id,revision,schema_version,snapshot FROM route_sheet_commercial_inventories
    WHERE id=$1 AND route_sheet_id=$2 AND cooperative_id=$3`,
      [tripRow.inventory_snapshot_id, ...pair],
    )
  ).rows[0];
  const cycle = (
    await client.query(
      'SELECT * FROM route_sheet_commercial_cycles WHERE id=$1 AND route_sheet_id=$2 AND cooperative_id=$3',
      [tripRow.cycle_id, ...pair],
    )
  ).rows[0];
  let series = null,
    cycles = [];
  if (cycle) {
    series = (
      await client.query(
        `SELECT id,cooperative_id,bus_group_id,base_route_sheet_id,base_start_at,cycle_length_days,
      to_char(base_start_at AT TIME ZONE 'America/Guayaquil','YYYY-MM-DD') AS base_start_date
      FROM route_sheet_commercial_series WHERE id=$1 AND cooperative_id=$2`,
        [cycle.series_id, cooperativeId],
      )
    ).rows[0];
    cycles = (
      await client.query(
        `SELECT c.id,c.route_sheet_id,c.cycle_number,c.start_at,c.end_exclusive,r.status,r.bus_group_id
      FROM route_sheet_commercial_cycles c JOIN route_sheets r ON r.id=c.route_sheet_id AND r.cooperative_id=c.cooperative_id
      WHERE c.series_id=$1 AND c.cooperative_id=$2 ORDER BY c.cycle_number`,
        [cycle.series_id, cooperativeId],
      )
    ).rows;
  }
  return {
    trip: {
      id: tripRow.id,
      cooperativeId,
      routeSheetId,
      assignmentId: tripRow.assignment_id,
      requiredServiceId: tripRow.required_service_id,
      frequencyId: tripRow.frequency_id,
      busId: tripRow.bus_id,
      cycleId: tripRow.cycle_id,
      inventorySnapshotId: tripRow.inventory_snapshot_id,
      programmingRevision: tripRow.programming_revision,
      tariffRevision: tripRow.tariff_revision,
      departureAt: iso(tripRow.departure_at),
      arrivalAt: iso(tripRow.arrival_at),
      routePoints: tripRow.route_points,
    },
    sheet: sheet
      ? {
          id: sheet.id,
          cooperativeId: sheet.cooperative_id,
          busGroupId: sheet.bus_group_id,
          status: sheet.status,
          tariff: sheet.tariff_frozen,
          tariffRevision: sheet.tariff_frozen_revision,
        }
      : null,
    programming: programming
      ? {
          revision: programming.revision,
          startAt: iso(programming.start_at),
          endExclusive: iso(programming.end_exclusive),
        }
      : null,
    assignment: assignment
      ? {
          id: assignment.id,
          requiredServiceId: assignment.required_service_id,
          frequencyId: assignment.frequency_id,
          busId: assignment.bus_id,
          departureAt: iso(assignment.departure_at),
          arrivalAt: iso(assignment.arrival_at),
          preparationMinutes: Number(assignment.preparation_minutes),
        }
      : null,
    required: required
      ? {
          id: required.id,
          frequencyId: required.frequency_id,
          departureAt: iso(required.departure_at),
        }
      : null,
    inventory: inventory
      ? {
          id: inventory.id,
          busId: inventory.bus_id,
          revision: inventory.revision,
          schemaVersion: inventory.schema_version,
          snapshot: inventory.snapshot,
        }
      : null,
    cycle: cycle
      ? {
          id: cycle.id,
          seriesId: cycle.series_id,
          routeSheetId: cycle.route_sheet_id,
          programmingRevision: cycle.programming_revision,
          tariffRevision: cycle.tariff_revision,
          startAt: iso(cycle.start_at),
          endExclusive: iso(cycle.end_exclusive),
          cycleNumber: cycle.cycle_number,
        }
      : null,
    series: series
      ? {
          id: series.id,
          cooperativeId: series.cooperative_id,
          busGroupId: series.bus_group_id,
          baseRouteSheetId: series.base_route_sheet_id,
          baseStartAt: iso(series.base_start_at),
          baseStartDate: series.base_start_date,
          cycleLengthDays: series.cycle_length_days,
        }
      : null,
    cycles: cycles.map((c) => ({
      id: c.id,
      routeSheetId: c.route_sheet_id,
      cycleNumber: c.cycle_number,
      startAt: iso(c.start_at),
      endExclusive: iso(c.end_exclusive),
      status: c.status,
      busGroupId: c.bus_group_id,
    })),
  };
}

class PgCommercialTripQueryRepository extends Port {
  constructor(pool) {
    super();
    this.pool = pool;
  }
  async withSnapshot(tripId, operation) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result = await operation(await readSnapshot(client, tripId));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* Conservar la causa original. */
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
module.exports = PgCommercialTripQueryRepository;
