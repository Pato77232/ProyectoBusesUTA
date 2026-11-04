class RouteSheetCycle {
  constructor({
    id,
    baseRouteSheetId,
    cooperativeId,
    busGroupId,
    cycleNumber,
    startDate,
    endDate,
    status = 'DRAFT',
    generatedBy = null,
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    if (!baseRouteSheetId) {
      throw new Error('El ID de la hoja base es obligatorio.');
    }
    if (!cooperativeId) {
      throw new Error('El ID de la cooperativa es obligatorio.');
    }
    if (!busGroupId) {
      throw new Error('El grupo de buses es obligatorio.');
    }
    if (cycleNumber !== 1 && cycleNumber !== 2) {
      throw new Error('El número de ciclo debe ser 1 o 2.');
    }
    if (!startDate || !endDate) {
      throw new Error('Las fechas del ciclo son obligatorias.');
    }
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
}

module.exports = RouteSheetCycle;
