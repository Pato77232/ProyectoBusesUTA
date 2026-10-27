class RouteSheetAssignment {
  constructor({ id, routeSheetId, cooperativeId, busGroupId, busId, frequencyId, createdAt = new Date(), updatedAt = new Date() }) {
    if (!routeSheetId) {
      throw new Error('El ID de la hoja de ruta es obligatorio.');
    }
    if (!cooperativeId) {
      throw new Error('El ID de la cooperativa es obligatorio.');
    }
    if (!busGroupId) {
      throw new Error('El grupo de buses es obligatorio.');
    }
    if (!busId) {
      throw new Error('El ID del bus es obligatorio.');
    }
    if (!frequencyId) {
      throw new Error('El ID de la frecuencia es obligatorio.');
    }
    this.id = id;
    this.routeSheetId = routeSheetId;
    this.cooperativeId = cooperativeId;
    this.busGroupId = busGroupId;
    this.busId = busId;
    this.frequencyId = frequencyId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = RouteSheetAssignment;
