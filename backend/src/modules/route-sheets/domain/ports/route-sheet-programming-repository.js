class RouteSheetProgrammingRepository {
  async findSnapshot(context) {
    throw new Error('findSnapshot requiere una lectura coherente de la hoja propia.');
  }
  // La sesión protege hoja, identidades, compromisos y escritura hasta commit.
  // operation recibe sheet, revision, frequencyQueryPort, findCommitments,
  // findIdentities y save. No recibe pg; el adaptador confirma o revierte todo.
  async withLockedProgramming(context, operation) {
    throw new Error('withLockedProgramming requiere una sesión transaccional.');
  }
}

module.exports = RouteSheetProgrammingRepository;
