class RouteSheetRestDay {
  constructor({ id, routeSheetId, cooperativeId, busGroupId, busId, reason = null, createdAt = new Date() }) {
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
    this.id = id;
    this.routeSheetId = routeSheetId;
    this.cooperativeId = cooperativeId;
    this.busGroupId = busGroupId;
    this.busId = busId;
    this.reason = reason;
    this.createdAt = createdAt;
  }
}

module.exports = RouteSheetRestDay;
