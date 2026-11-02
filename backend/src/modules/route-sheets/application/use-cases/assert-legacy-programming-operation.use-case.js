const { RouteProgrammingConflictError } = require('../../domain/errors/route-programming-errors');

function assertLegacyProgrammingOperation({ getProgramming }) {
  return async (context) => {
    const record = await getProgramming(context);
    if (record.programming)
      throw new RouteProgrammingConflictError(
        'ROUTE_PROGRAMMING_LEGACY_OPERATION',
        'Esta hoja requiere editar la programación completa; usa el apartado de programación.',
      );
  };
}

module.exports = assertLegacyProgrammingOperation;
