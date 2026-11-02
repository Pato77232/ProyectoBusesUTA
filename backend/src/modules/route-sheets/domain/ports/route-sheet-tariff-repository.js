class RouteSheetTariffRepository {
  async withLockedSheet(context, operation) {
    throw new Error('withLockedSheet debe implementar una transacción de tarifario.');
  }
}

module.exports = RouteSheetTariffRepository;
