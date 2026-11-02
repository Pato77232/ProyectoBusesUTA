const RouteSheetTariffRepository = require('../../domain/ports/route-sheet-tariff-repository');
const { TariffNotFoundError } = require('../../domain/errors/route-tariff-errors');
const { toRouteSheet } = require('../mappers/route-sheet-mapper');

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
  async findPublishedById(routeSheetId, cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT id, cooperative_id, bus_group_id,
      tariff_frozen, tariff_frozen_revision, tariff_frozen_at
      FROM route_sheets WHERE id = $1 AND cooperative_id = $2
      AND status = 'PUBLISHED' AND tariff_frozen IS NOT NULL`,
      [routeSheetId, cooperativeId],
    );
    return rows[0] ?? null;
  }

  constructor(pool, { frequencySessionFactory } = {}) {
    super();
    this.pool = pool;
    this.frequencySessionFactory = frequencySessionFactory;
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
      const freeze = async (tariff) => {
        const { rows: published } = await client.query(
          `UPDATE route_sheets SET
          status = 'PUBLISHED', published_by = $1, published_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP, tariff_frozen = $2::jsonb,
          tariff_frozen_revision = tariff_revision, tariff_frozen_at = CURRENT_TIMESTAMP,
          tariff_frozen_by = $1 WHERE id = $3 AND cooperative_id = $4 RETURNING *`,
          [modifiedBy, JSON.stringify(tariff), routeSheetId, cooperativeId],
        );
        return toRouteSheet(published[0]);
      };
      const result = await operation({
        sheet,
        frequencyIds: assignments.rows.map(({ frequency_id }) => frequency_id),
        save,
        freeze,
        toEntity: toRouteSheet,
        frequencyQueryPort: this.frequencySessionFactory?.(client),
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
