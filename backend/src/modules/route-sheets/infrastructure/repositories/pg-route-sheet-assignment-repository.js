const RouteSheetAssignmentRepository = require('../../domain/ports/route-sheet-assignment-repository');
const { toAssignment } = require('../mappers/route-sheet-mapper');

class PgRouteSheetAssignmentRepository extends RouteSheetAssignmentRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findByRouteSheetId(routeSheetId, cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM route_sheet_assignments WHERE route_sheet_id = $1 AND cooperative_id = $2`,
      [routeSheetId, cooperativeId],
    );
    return rows.map((row) => toAssignment(row));
  }

  async deleteByRouteSheetId(routeSheetId, cooperativeId) {
    await this.pool.query(
      `DELETE FROM route_sheet_assignments WHERE route_sheet_id = $1 AND cooperative_id = $2`,
      [routeSheetId, cooperativeId],
    );
  }

  async countByRouteSheetId(routeSheetId, cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*) as count FROM route_sheet_assignments WHERE route_sheet_id = $1 AND cooperative_id = $2`,
      [routeSheetId, cooperativeId],
    );
    return Number(rows[0].count);
  }

  async save(assignment) {
    const { rows } = await this.pool.query(
      `INSERT INTO route_sheet_assignments (route_sheet_id, cooperative_id, bus_group_id, bus_id, frequency_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [assignment.routeSheetId, assignment.cooperativeId, assignment.busGroupId, assignment.busId, assignment.frequencyId],
    );
    return toAssignment(rows[0]);
  }

  async removeById(id, cooperativeId) {
    await this.pool.query(
      `DELETE FROM route_sheet_assignments WHERE id = $1 AND cooperative_id = $2`,
      [id, cooperativeId],
    );
  }

  async deleteById(id, cooperativeId) {
    return this.removeById(id, cooperativeId);
  }
}

module.exports = PgRouteSheetAssignmentRepository;
