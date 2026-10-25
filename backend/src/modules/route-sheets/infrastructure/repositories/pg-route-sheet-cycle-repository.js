const RouteSheetCycleRepository = require('../../domain/ports/route-sheet-cycle-repository');
const { toCycle } = require('../mappers/route-sheet-cycle-mapper');

class PgRouteSheetCycleRepository extends RouteSheetCycleRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findByBaseRouteSheetId(baseRouteSheetId, cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM route_sheet_cycles WHERE base_route_sheet_id = $1 AND cooperative_id = $2 ORDER BY cycle_number ASC`,
      [baseRouteSheetId, cooperativeId],
    );
    return rows.map((row) => toCycle(row));
  }

  async findAllByCooperative(cooperativeId, filters = {}) {
    const conditions = ['cooperative_id = $1'];
    const values = [cooperativeId];
    let index = 2;

    if (filters.busGroupId) {
      conditions.push(`bus_group_id = $${index}`);
      values.push(filters.busGroupId);
      index += 1;
    }

    const { rows } = await this.pool.query(
      `SELECT * FROM route_sheet_cycles WHERE ${conditions.join(' AND ')} ORDER BY start_date ASC`,
      values,
    );
    return rows.map((row) => toCycle(row));
  }

  async save(cycle) {
    const { rows } = await this.pool.query(
      `INSERT INTO route_sheet_cycles (base_route_sheet_id, cooperative_id, bus_group_id, cycle_number, start_date, end_date, status, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        cycle.baseRouteSheetId,
        cycle.cooperativeId,
        cycle.busGroupId,
        cycle.cycleNumber,
        cycle.startDate,
        cycle.endDate,
        cycle.status,
        cycle.generatedBy,
      ],
    );
    return toCycle(rows[0]);
  }

  async countByBaseRouteSheetId(baseRouteSheetId, cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*) as count FROM route_sheet_cycles WHERE base_route_sheet_id = $1 AND cooperative_id = $2`,
      [baseRouteSheetId, cooperativeId],
    );
    return Number(rows[0].count);
  }
}

module.exports = PgRouteSheetCycleRepository;
