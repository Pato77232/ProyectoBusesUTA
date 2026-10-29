const RouteSheetCycle = require('../../domain/entities/route-sheet-cycle');

function toCycle(row) {
  if (!row) {
    return null;
  }
  return new RouteSheetCycle({
    id: row.id,
    baseRouteSheetId: row.base_route_sheet_id,
    cooperativeId: row.cooperative_id,
    busGroupId: row.bus_group_id,
    cycleNumber: row.cycle_number,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    generatedBy: row.generated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

module.exports = { toCycle };
