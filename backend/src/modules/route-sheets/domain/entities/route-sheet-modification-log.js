class RouteSheetModificationLog {
  constructor({
    id,
    routeSheetId,
    routeSheetCycleId = null,
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
    passengersNotifiedContext = null,
    createdAt = new Date(),
  }) {
    if (!routeSheetId) {
      throw new Error('El ID de la hoja de ruta es obligatorio.');
    }
    if (!cooperativeId) {
      throw new Error('El ID de la cooperativa es obligatorio.');
    }
    if (!busGroupId) {
      throw new Error('El grupo de buses es obligatorio.');
    }
    if (!modifiedBy) {
      throw new Error('El usuario que modifica es obligatorio.');
    }
    if (!reason || reason.trim() === '') {
      throw new Error('La razón de la modificación es obligatoria.');
    }
    if (!action) {
      throw new Error('La acción es obligatoria.');
    }
    if (!affectedEntity) {
      throw new Error('La entidad afectada es obligatoria.');
    }
    if (!entityId) {
      throw new Error('El ID de la entidad afectada es obligatorio.');
    }
    this.id = id;
    this.routeSheetId = routeSheetId;
    this.routeSheetCycleId = routeSheetCycleId;
    this.cooperativeId = cooperativeId;
    this.busGroupId = busGroupId;
    this.modifiedBy = modifiedBy;
    this.reason = reason.trim();
    this.action = action;
    this.affectedEntity = affectedEntity;
    this.entityId = entityId;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.hasPassengersWarning = Boolean(hasPassengersWarning);
    this.passengersNotifiedContext = passengersNotifiedContext;
    this.createdAt = createdAt;
  }
}

module.exports = RouteSheetModificationLog;
