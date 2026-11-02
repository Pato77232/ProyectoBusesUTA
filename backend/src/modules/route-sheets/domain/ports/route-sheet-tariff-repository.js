class RouteSheetTariffRepository {
  async findPublishedById(routeSheetId, cooperativeId) {
    throw new Error(
      'findPublishedById debe consultar solo una tarifa publicada de la cooperativa.',
    );
  }

  async withLockedSheet(context, operation) {
    throw new Error('withLockedSheet debe implementar una transacción de tarifario.');
  }
}

module.exports = RouteSheetTariffRepository;
