const RouteSheetModificationLog = require('../../domain/entities/route-sheet-modification-log');

function toModificationLog(row) {
  if (!row) {
    return null;
  }
  return new RouteSheetModificationLog({
    id: row.id,
    routeSheetId: row.route_sheet_id,
    routeSheetCycleId: row.route_sheet_cycle_id,
    cooperativeId: row.cooperative_id,
    busGroupId: row.bus_group_id,
    modifiedBy: row.modified_by,
    reason: row.reason,
    action: row.action,
    affectedEntity: row.affected_entity,
    entityId: row.entity_id,
    oldValue: row.old_value,
    newValue: row.new_value,
    hasPassengersWarning: row.has_passengers_warning,
    passengersNotifiedContext: row.passengers_notified_context,
    createdAt: row.created_at,
  });
}

module.exports = { toModificationLog };
