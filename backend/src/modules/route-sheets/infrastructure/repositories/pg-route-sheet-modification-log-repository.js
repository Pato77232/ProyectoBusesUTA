const RouteSheetModificationLogRepository = require('../../domain/ports/route-sheet-modification-log-repository');
const { toModificationLog } = require('../mappers/route-sheet-modification-log-mapper');

class PgRouteSheetModificationLogRepository extends RouteSheetModificationLogRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async save(log) {
    const { rows } = await this.pool.query(
      `INSERT INTO route_sheet_modification_logs (route_sheet_id, route_sheet_cycle_id, cooperative_id, bus_group_id, modified_by, reason, action, affected_entity, entity_id, old_value, new_value, has_passengers_warning, passengers_notified_context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        log.routeSheetId,
        log.routeSheetCycleId,
        log.cooperativeId,
        log.busGroupId,
        log.modifiedBy,
        log.reason,
        log.action,
        log.affectedEntity,
        log.entityId,
        log.oldValue ? JSON.stringify(log.oldValue) : null,
        log.newValue ? JSON.stringify(log.newValue) : null,
        log.hasPassengersWarning,
        log.passengersNotifiedContext ? JSON.stringify(log.passengersNotifiedContext) : null,
      ],
    );
    return toModificationLog(rows[0]);
  }

  async findByRouteSheetId(routeSheetId, cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM route_sheet_modification_logs WHERE route_sheet_id = $1 AND cooperative_id = $2 ORDER BY created_at DESC`,
      [routeSheetId, cooperativeId],
    );
    return rows.map((row) => toModificationLog(row));
  }

  async findByFilters(cooperativeId, filters = {}) {
    const conditions = ['cooperative_id = $1'];
    const values = [cooperativeId];
    let index = 2;

    if (filters.routeSheetId) {
      conditions.push(`route_sheet_id = $${index}`);
      values.push(filters.routeSheetId);
      index += 1;
    }
    if (filters.modifiedBy) {
      conditions.push(`modified_by = $${index}`);
      values.push(filters.modifiedBy);
      index += 1;
    }

    const { rows } = await this.pool.query(
      `SELECT * FROM route_sheet_modification_logs WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      values,
    );
    return rows.map((row) => toModificationLog(row));
  }
}

module.exports = PgRouteSheetModificationLogRepository;
