class RouteSheetModificationLogDTO {
  constructor({
    id,
    routeSheetId,
    routeSheetCycleId,
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
    passengersNotifiedContext,
    createdAt,
  }) {
    this.id = id;
    this.routeSheetId = routeSheetId;
    this.routeSheetCycleId = routeSheetCycleId;
    this.cooperativeId = cooperativeId;
    this.busGroupId = busGroupId;
    this.modifiedBy = modifiedBy;
    this.reason = reason;
    this.action = action;
    this.affectedEntity = affectedEntity;
    this.entityId = entityId;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.hasPassengersWarning = Boolean(hasPassengersWarning);
    this.passengersNotifiedContext = passengersNotifiedContext;
    this.createdAt = createdAt;
  }

  static fromEntity(entity) {
    return new RouteSheetModificationLogDTO({
      id: entity.id,
      routeSheetId: entity.routeSheetId,
      routeSheetCycleId: entity.routeSheetCycleId,
      cooperativeId: entity.cooperativeId,
      busGroupId: entity.busGroupId,
      modifiedBy: entity.modifiedBy,
      reason: entity.reason,
      action: entity.action,
      affectedEntity: entity.affectedEntity,
      entityId: entity.entityId,
      oldValue: entity.oldValue,
      newValue: entity.newValue,
      hasPassengersWarning: entity.hasPassengersWarning,
      passengersNotifiedContext: entity.passengersNotifiedContext,
      createdAt: entity.createdAt,
    });
  }
}

module.exports = RouteSheetModificationLogDTO;
