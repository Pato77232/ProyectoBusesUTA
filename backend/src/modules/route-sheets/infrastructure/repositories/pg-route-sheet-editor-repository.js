const Port = require('../../domain/ports/route-sheet-editor-repository');
const { readProgramming } = require('./programming-records');
const restoreTariff = require('../../domain/value-objects/restore-tariff-snapshot');
const { ProgrammingNotFoundError } = require('../../domain/errors/programming-persistence-errors');

class PgRouteSheetEditorRepository extends Port {
  constructor(pool) {
    super();
    this.pool = pool;
  }
  async findSnapshot({ routeSheetId, cooperativeId }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const { rows } = await client.query(
        `SELECT s.*,to_char(s.route_date,'YYYY-MM-DD') AS date,
          EXISTS(SELECT 1 FROM route_sheet_assignments a WHERE a.route_sheet_id=s.id AND a.cooperative_id=s.cooperative_id AND a.required_service_id IS NULL)
          OR EXISTS(SELECT 1 FROM route_sheet_rest_days r WHERE r.route_sheet_id=s.id AND r.cooperative_id=s.cooperative_id) AS legacy
         FROM route_sheets s WHERE s.id=$1 AND s.cooperative_id=$2`,
        [routeSheetId, cooperativeId],
      );
      const row = rows[0];
      if (!row) throw new ProgrammingNotFoundError();
      const programming = await readProgramming(client, routeSheetId, cooperativeId);
      const published = row.status === 'PUBLISHED';
      const revision = published ? (row.tariff_frozen_revision ?? 0) : row.tariff_revision;
      const source = published ? row.tariff_frozen : row.tariff_draft;
      const tariff = source === null ? null : restoreTariff(source, revision);
      await client.query('COMMIT');
      return {
        sheet: {
          id: row.id,
          cooperativeId: row.cooperative_id,
          busGroupId: row.bus_group_id,
          routeDate: row.date,
          status: row.status,
          hasLegacyAssignments: row.legacy,
        },
        programming: programming ?? { routeSheetId, cooperativeId, revision: 0, programming: null },
        tariff: { routeSheetId, cooperativeId, revision, tariff },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
module.exports = PgRouteSheetEditorRepository;
