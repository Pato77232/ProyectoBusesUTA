const RouteSheet = require('../../domain/entities/route-sheet');
const RouteSheetAssignment = require('../../domain/entities/route-sheet-assignment');
const RouteSheetRestDay = require('../../domain/entities/route-sheet-rest-day');
const RouteSheetStatus = require('../../domain/value-objects/route-sheet-status');

function toRouteSheet(row) {
  if (!row) {
    return null;
  }
  return new RouteSheet({
    id: row.id,
    cooperativeId: row.cooperative_id,
    busGroupId: row.bus_group_id,
    routeDate: row.route_date,
    status: row.status ? new RouteSheetStatus(row.status) : undefined,
    isBase: row.is_base,
    cycleLengthWeeks: row.cycle_length_weeks,
    createdBy: row.created_by,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function toAssignment(row) {
  if (!row) {
    return null;
  }
  return new RouteSheetAssignment({
    id: row.id,
    routeSheetId: row.route_sheet_id,
    cooperativeId: row.cooperative_id,
    busGroupId: row.bus_group_id,
    busId: row.bus_id,
    frequencyId: row.frequency_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function toRestDay(row) {
  if (!row) {
    return null;
  }
  return new RouteSheetRestDay({
    id: row.id,
    routeSheetId: row.route_sheet_id,
    cooperativeId: row.cooperative_id,
    busGroupId: row.bus_group_id,
    busId: row.bus_id,
    reason: row.reason,
    createdAt: row.created_at,
  });
}

module.exports = { toRouteSheet, toAssignment, toRestDay };
