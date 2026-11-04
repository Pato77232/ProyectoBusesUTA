const RouteSheetModificationLog = require('../../domain/entities/route-sheet-modification-log');

/**
 * Escribe un log de auditoría cuando la solicitud informa un motivo.
 *
 * El motivo no es obligatorio en este alcance (ROUTE-SHEETS-09, Q1): sin motivo
 * el cambio se aplica igual que antes y no se registra auditoría. Si el
 * repositorio no está inyectado tampoco se escribe, igual que el resto de
 * dependencias opcionales de estos casos de uso.
 */
async function recordRouteSheetModification({
  repository,
  routeSheetId,
  cooperativeId,
  busGroupId,
  modifiedBy,
  reason,
  action,
  affectedEntity,
  entityId,
  oldValue = null,
  newValue = null,
  hasPassengersWarning = false,
}) {
  if (typeof reason !== 'string' || reason.trim() === '') return null;
  if (!repository || typeof repository.save !== 'function') return null;

  const log = new RouteSheetModificationLog({
    routeSheetId,
    cooperativeId,
    busGroupId,
    modifiedBy,
    reason,
    action,
    affectedEntity,
    entityId,
    oldValue,
    newValue,
    hasPassengersWarning,
  });
  return repository.save(log);
}

module.exports = recordRouteSheetModification;
