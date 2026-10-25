const RouteDate = require('../../domain/value-objects/route-date');

class RouteSheetDTO {
  constructor({
    id,
    cooperativeId,
    busGroupId,
    routeDate,
    status,
    isBase,
    cycleLengthWeeks,
    createdBy,
    publishedBy,
    publishedAt,
    notes,
    assignments = [],
    restDays = [],
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.cooperativeId = cooperativeId;
    this.busGroupId = busGroupId;
    this.routeDate = routeDate;
    this.status = status;
    this.isBase = Boolean(isBase);
    this.cycleLengthWeeks = cycleLengthWeeks;
    this.createdBy = createdBy;
    this.publishedBy = publishedBy;
    this.publishedAt = publishedAt;
    this.notes = notes;
    this.assignments = assignments;
    this.restDays = restDays;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static fromEntity(entity, assignments = [], restDays = []) {
    return new RouteSheetDTO({
      id: entity.id,
      cooperativeId: entity.cooperativeId,
      busGroupId: entity.busGroupId,
      routeDate: new RouteDate(entity.routeDate).toString(),
      status: entity.status?.toString ? entity.status.toString() : entity.status,
      isBase: entity.isBase,
      cycleLengthWeeks: entity.cycleLengthWeeks,
      createdBy: entity.createdBy,
      publishedBy: entity.publishedBy,
      publishedAt: entity.publishedAt,
      notes: entity.notes,
      assignments,
      restDays,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}

module.exports = RouteSheetDTO;
