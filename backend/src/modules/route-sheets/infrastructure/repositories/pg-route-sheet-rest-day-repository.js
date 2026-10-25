const RouteSheetRestDayRepository = require('../../domain/ports/route-sheet-rest-day-repository');
const { toRestDay } = require('../mappers/route-sheet-mapper');

class PgRouteSheetRestDayRepository extends RouteSheetRestDayRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findByRouteSheetId(routeSheetId, cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM route_sheet_rest_days WHERE route_sheet_id = $1 AND cooperative_id = $2`,
      [routeSheetId, cooperativeId],
    );
    return rows.map((row) => toRestDay(row));
  }

  async deleteByRouteSheetId(routeSheetId, cooperativeId) {
    await this.pool.query(
      `DELETE FROM route_sheet_rest_days WHERE route_sheet_id = $1 AND cooperative_id = $2`,
      [routeSheetId, cooperativeId],
    );
  }

  async save(restDay) {
    const { rows } = await this.pool.query(
      `INSERT INTO route_sheet_rest_days (route_sheet_id, cooperative_id, bus_group_id, bus_id, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [restDay.routeSheetId, restDay.cooperativeId, restDay.busGroupId, restDay.busId, restDay.reason],
    );
    return toRestDay(rows[0]);
  }

  async removeById(id, cooperativeId) {
    await this.pool.query(
      `DELETE FROM route_sheet_rest_days WHERE id = $1 AND cooperative_id = $2`,
      [id, cooperativeId],
    );
  }

  async deleteById(id, cooperativeId) {
    return this.removeById(id, cooperativeId);
  }
}

module.exports = PgRouteSheetRestDayRepository;
