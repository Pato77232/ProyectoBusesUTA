class RouteSheetCycleDTO {
  constructor({
    id,
    baseRouteSheetId,
    cooperativeId,
    busGroupId,
    cycleNumber,
    startDate,
    endDate,
    status,
    generatedBy,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.baseRouteSheetId = baseRouteSheetId;
    this.cooperativeId = cooperativeId;
    this.busGroupId = busGroupId;
    this.cycleNumber = cycleNumber;
    this.startDate = startDate;
    this.endDate = endDate;
    this.status = status;
    this.generatedBy = generatedBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static fromEntity(entity) {
    return new RouteSheetCycleDTO({
      id: entity.id,
      baseRouteSheetId: entity.baseRouteSheetId,
      cooperativeId: entity.cooperativeId,
      busGroupId: entity.busGroupId,
      cycleNumber: entity.cycleNumber,
      startDate: entity.startDate,
      endDate: entity.endDate,
      status: entity.status,
      generatedBy: entity.generatedBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}

module.exports = RouteSheetCycleDTO;
