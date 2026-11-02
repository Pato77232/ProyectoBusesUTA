const RouteSheetTariffRepository = require('../../domain/ports/route-sheet-tariff-repository');
const { TariffNotFoundError } = require('../../domain/errors/route-tariff-errors');

function toResult(row) {
  return {
    routeSheetId: row.id,
    cooperativeId: row.cooperative_id,
    busGroupId: row.bus_group_id,
    revision: row.tariff_revision,
    tariff: row.tariff_draft,
    updatedBy: row.tariff_updated_by,
    updatedAt: row.tariff_updated_at.toISOString(),
  };
}

class PgRouteSheetTariffRepository extends RouteSheetTariffRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async withLockedSheet({ routeSheetId, cooperativeId, modifiedBy }, operation) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT * FROM route_sheets WHERE id = $1 AND cooperative_id = $2 FOR UPDATE',
        [routeSheetId, cooperativeId],
      );
      const sheet = rows[0];
      if (!sheet) throw new TariffNotFoundError();
      const assignments = await client.query(
        'SELECT frequency_id FROM route_sheet_assignments WHERE route_sheet_id = $1 AND cooperative_id = $2 ORDER BY frequency_id FOR SHARE',
        [routeSheetId, cooperativeId],
      );
      const save = async (tariff) => {
        const updated = await client.query(
          `UPDATE route_sheets SET tariff_draft = $1::jsonb,
          tariff_revision = tariff_revision + 1, tariff_updated_by = $2,
          tariff_updated_at = CURRENT_TIMESTAMP
          WHERE id = $3 AND cooperative_id = $4 RETURNING *`,
          [JSON.stringify(tariff), modifiedBy, routeSheetId, cooperativeId],
        );
        return toResult(updated.rows[0]);
      };
      const result = await operation({
        sheet,
        frequencyIds: assignments.rows.map(({ frequency_id }) => frequency_id),
        save,
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* Conservar el error original. */
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = PgRouteSheetTariffRepository;
