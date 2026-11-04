class RouteSheetRestDayDTO {
  constructor({ id, routeSheetId, cooperativeId, busGroupId, busId, reason, createdAt }) {
    this.id = id;
    this.routeSheetId = routeSheetId;
    this.cooperativeId = cooperativeId;
    this.busGroupId = busGroupId;
    this.busId = busId;
    this.reason = reason;
    this.createdAt = createdAt;
  }

  static fromEntity(entity) {
    return new RouteSheetRestDayDTO({
      id: entity.id,
      routeSheetId: entity.routeSheetId,
      cooperativeId: entity.cooperativeId,
      busGroupId: entity.busGroupId,
      busId: entity.busId,
      reason: entity.reason,
      createdAt: entity.createdAt,
    });
  }
}

module.exports = RouteSheetRestDayDTO;
