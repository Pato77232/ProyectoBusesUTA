const RouteSheetRepository = require('../../domain/ports/route-sheet-repository');
const { toRouteSheet } = require('../mappers/route-sheet-mapper');

class PgRouteSheetRepository extends RouteSheetRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findById(id, cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM route_sheets WHERE id = $1 AND cooperative_id = $2`,
      [id, cooperativeId],
    );
    return toRouteSheet(rows[0]);
  }

  async findByDateAndGroup(cooperativeId, busGroupId, routeDate) {
    const { rows } = await this.pool.query(
      `SELECT * FROM route_sheets WHERE cooperative_id = $1 AND bus_group_id = $2 AND route_date = $3`,
      [cooperativeId, busGroupId, routeDate],
    );
    return toRouteSheet(rows[0]);
  }

  async findAll(cooperativeId, filters = {}) {
    const conditions = ['cooperative_id = $1'];
    const values = [cooperativeId];
    let index = 2;

    if (filters.busGroupId) {
      conditions.push(`bus_group_id = $${index}`);
      values.push(filters.busGroupId);
      index += 1;
    }
    if (filters.fromDate) {
      conditions.push(`route_date >= $${index}`);
      values.push(filters.fromDate);
      index += 1;
    }
    if (filters.toDate) {
      conditions.push(`route_date <= $${index}`);
      values.push(filters.toDate);
      index += 1;
    }
    if (filters.status) {
      conditions.push(`status = $${index}`);
      values.push(filters.status);
      index += 1;
    }

    const { rows } = await this.pool.query(
      `SELECT * FROM route_sheets WHERE ${conditions.join(' AND ')} ORDER BY route_date ASC`,
      values,
    );
    return rows.map((row) => toRouteSheet(row));
  }

  async findBaseForCycles(id, cooperativeId) {
    return this.findById(id, cooperativeId);
  }

  async existsByDateAndGroup(cooperativeId, busGroupId, routeDate) {
    const { rows } = await this.pool.query(
      `SELECT 1 FROM route_sheets WHERE cooperative_id = $1 AND bus_group_id = $2 AND route_date = $3`,
      [cooperativeId, busGroupId, routeDate],
    );
    return rows.length > 0;
  }

  async save(routeSheet) {
    if (routeSheet.id) {
      const { rows } = await this.pool.query(
        `UPDATE route_sheets SET status = $1, is_base = $2, cycle_length_weeks = $3, published_by = $4, published_at = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 AND cooperative_id = $8
         RETURNING *`,
        [
          routeSheet.status?.toString ? routeSheet.status.toString() : routeSheet.status,
          routeSheet.isBase,
          routeSheet.cycleLengthWeeks,
          routeSheet.publishedBy,
          routeSheet.publishedAt,
          routeSheet.notes,
          routeSheet.id,
          routeSheet.cooperativeId,
        ],
      );
      return toRouteSheet(rows[0]);
    }

    const { rows } = await this.pool.query(
      `INSERT INTO route_sheets (cooperative_id, bus_group_id, route_date, status, is_base, cycle_length_weeks, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        routeSheet.cooperativeId,
        routeSheet.busGroupId,
        routeSheet.routeDate,
        routeSheet.status?.toString ? routeSheet.status.toString() : routeSheet.status,
        routeSheet.isBase || false,
        routeSheet.cycleLengthWeeks,
        routeSheet.createdBy,
        routeSheet.notes,
      ],
    );
    return toRouteSheet(rows[0]);
  }
}

module.exports = PgRouteSheetRepository;
