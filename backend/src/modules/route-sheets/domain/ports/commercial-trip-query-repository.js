class CommercialTripQueryRepository {
  // Catálogo de solo lectura: deriva tenant del tripId persistido y filtra todas
  // las lecturas posteriores por ese tenant. operation recibe un snapshot o null.
  async withSnapshot(tripId, operation) {
    throw new Error('withSnapshot requiere una lectura comercial consistente.');
  }
}
module.exports = CommercialTripQueryRepository;
