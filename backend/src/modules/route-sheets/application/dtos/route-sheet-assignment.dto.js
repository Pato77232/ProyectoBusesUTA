class RouteSheetAssignmentDTO {
  constructor({ id, routeSheetId, cooperativeId, busGroupId, busId, frequencyId, createdAt, updatedAt }) {
    this.id = id;
    this.routeSheetId = routeSheetId;
    this.cooperativeId = cooperativeId;
    this.busGroupId = busGroupId;
    this.busId = busId;
    this.frequencyId = frequencyId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static fromEntity(entity) {
    return new RouteSheetAssignmentDTO({
      id: entity.id,
      routeSheetId: entity.routeSheetId,
      cooperativeId: entity.cooperativeId,
      busGroupId: entity.busGroupId,
      busId: entity.busId,
      frequencyId: entity.frequencyId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}

module.exports = RouteSheetAssignmentDTO;
