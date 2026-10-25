const RouteSheetStatus = require('../value-objects/route-sheet-status');
const { RouteSheetNotEditableError } = require('../errors/route-sheet-errors');

class RouteSheet {
  constructor({
    id,
    cooperativeId,
    busGroupId,
    routeDate,
    status,
    isBase = false,
    cycleLengthWeeks = null,
    createdBy = null,
    publishedBy = null,
    publishedAt = null,
    notes = null,
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    if (!cooperativeId) {
      throw new Error('El ID de la cooperativa es obligatorio.');
    }
    if (!busGroupId) {
      throw new Error('El grupo de buses es obligatorio.');
    }
    if (!routeDate) {
      throw new Error('La fecha de la hoja de ruta es obligatoria.');
    }
    this.id = id;
    this.cooperativeId = cooperativeId;
    this.busGroupId = busGroupId;
    this.routeDate = routeDate;
    this.status = status instanceof RouteSheetStatus ? status : new RouteSheetStatus(status || 'DRAFT');
    this.isBase = Boolean(isBase);
    this.cycleLengthWeeks = cycleLengthWeeks;
    this.createdBy = createdBy;
    this.publishedBy = publishedBy;
    this.publishedAt = publishedAt;
    this.notes = notes;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isEditable() {
    return this.status.isDraft();
  }

  publish(publishedBy) {
    if (!this.isEditable()) {
      throw new RouteSheetNotEditableError();
    }
    this.status = RouteSheetStatus.published();
    this.publishedBy = publishedBy;
    this.publishedAt = new Date();
    this.updatedAt = new Date();
    return this;
  }

  assertEditable() {
    if (!this.isEditable()) {
      throw new RouteSheetNotEditableError();
    }
  }

  markAsBase() {
    this.isBase = true;
    this.updatedAt = new Date();
    return this;
  }

  setCycleLengthWeeks(weeks) {
    this.cycleLengthWeeks = weeks;
    this.updatedAt = new Date();
    return this;
  }
}

module.exports = RouteSheet;
