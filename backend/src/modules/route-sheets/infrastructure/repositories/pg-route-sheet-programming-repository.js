const RouteSheetProgrammingRepository = require('../../domain/ports/route-sheet-programming-repository');
const { ProgrammingNotFoundError } = require('../../domain/errors/programming-persistence-errors');
const { RouteProgrammingConflictError } = require('../../domain/errors/route-programming-errors');
const { programmingIdentities } = require('../../domain/value-objects/programming-identities');
const lockWrites = require('../programming-write-lock');
const { readProgramming, writeProgramming } = require('./programming-records');

async function findIdentities(client, context, candidate) {
  const entries = programmingIdentities(candidate);
  const { rows } = await client.query(
    'SELECT * FROM route_sheet_programming_ids WHERE id=ANY($1::uuid[]) AND cooperative_id=$2',
    [entries.map((r) => r.id), context.cooperativeId],
  );
  const { rows: legacy } = await client.query(
    'SELECT id,route_sheet_id,cooperative_id FROM route_sheet_assignments WHERE id=ANY($1::uuid[]) AND cooperative_id=$2 AND required_service_id IS NULL',
    [entries.map((r) => r.id), context.cooperativeId],
  );
  return {
    hasLegacyIds: legacy.length > 0,
    known: rows.map((row) => ({
      id: row.id,
      routeSheetId: row.route_sheet_id,
      cooperativeId: row.cooperative_id,
      kind: row.kind,
      frequencyId: row.frequency_id,
      departureAt: row.departure_at ? new Date(row.departure_at).toISOString() : null,
    })),
  };
}

async function findCommitments(client, context, candidate) {
  const busIds = candidate.agendas.map((a) => a.busId);
  const { rows: legacy } = await client.query(
    `SELECT a.id FROM route_sheet_assignments a
    LEFT JOIN route_sheet_programmings p ON p.route_sheet_id=a.route_sheet_id
    WHERE a.cooperative_id=$1 AND a.route_sheet_id<>$2 AND a.bus_id=ANY($3::uuid[]) AND p.route_sheet_id IS NULL
    UNION ALL SELECT r.id FROM route_sheet_rest_days r LEFT JOIN route_sheet_programmings p ON p.route_sheet_id=r.route_sheet_id
    WHERE r.cooperative_id=$1 AND r.route_sheet_id<>$2 AND r.bus_id=ANY($3::uuid[]) AND p.route_sheet_id IS NULL`,
    [context.cooperativeId, context.routeSheetId, busIds],
  );
  const { rows: headers } = await client.query(
    `SELECT p.*,s.bus_group_id FROM route_sheet_programmings p
    JOIN route_sheets s ON s.id=p.route_sheet_id AND s.cooperative_id=p.cooperative_id
    WHERE p.cooperative_id=$1 AND p.route_sheet_id<>$2 ORDER BY p.start_at,p.route_sheet_id`,
    [context.cooperativeId, context.routeSheetId],
  );
  const programs = [];
  for (const header of headers) {
    const record = await readProgramming(client, header.route_sheet_id, context.cooperativeId);
    programs.push({ ...record.programming, busGroupId: header.bus_group_id });
  }
  const { rows: legacyCycles } = await client.query(
    `SELECT id FROM route_sheet_cycles WHERE cooperative_id=$1 AND bus_group_id=$2
    AND end_date >= $3::date`,
    [context.cooperativeId, candidate.busGroupId, candidate.cycleStartDate],
  );
  return {
    programs,
    hasLegacyConflicts: legacy.length > 0,
    hasLegacyCycles: legacyCycles.length > 0,
  };
}

class PgRouteSheetProgrammingRepository extends RouteSheetProgrammingRepository {
  constructor(pool, { frequencySessionFactory } = {}) {
    super();
    this.pool = pool;
    this.frequencySessionFactory = frequencySessionFactory;
  }

  async withLockedProgramming(context, operation) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await lockWrites(client);
      const { rows } = await client.query(
        "SELECT *,to_char(route_date,'YYYY-MM-DD') AS route_date FROM route_sheets WHERE id=$1 AND cooperative_id=$2 FOR UPDATE",
        [context.routeSheetId, context.cooperativeId],
      );
      if (!rows[0]) throw new ProgrammingNotFoundError();
      const row = rows[0];
      const current = await readProgramming(client, context.routeSheetId, context.cooperativeId);
      const revision = current?.revision ?? 0;
      const result = await operation({
        sheet: {
          status: row.status,
          busGroupId: row.bus_group_id,
          routeDate:
            row.route_date instanceof Date
              ? row.route_date.toISOString().slice(0, 10)
              : row.route_date,
        },
        revision,
        frequencyQueryPort: this.frequencySessionFactory?.(client),
        findCommitments: (candidate) => findCommitments(client, context, candidate),
        findIdentities: (candidate) => findIdentities(client, context, candidate),
        save: (candidate) => writeProgramming(client, context, candidate, revision + 1),
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* Preservar la causa original. */
      }
      if (error.code === '23505')
        throw new RouteProgrammingConflictError(
          'ROUTE_PROGRAMMING_IDENTITY_CONFLICT',
          'Una identidad o salida ya está registrada.',
        );
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = PgRouteSheetProgrammingRepository;
