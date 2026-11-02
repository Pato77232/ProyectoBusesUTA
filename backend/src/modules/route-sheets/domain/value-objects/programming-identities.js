const { RouteProgrammingConflictError } = require('../errors/route-programming-errors');

function programmingIdentities(candidate) {
  return [
    ...candidate.requiredServices.map((s) => ({ ...s, kind: 'REQUIRED' })),
    ...candidate.agendas.flatMap((a) => [...a.activities, ...a.blocks]),
  ];
}

function assertProgrammingIdentities(candidate, { known, hasLegacyIds }, context) {
  if (hasLegacyIds)
    throw new RouteProgrammingConflictError(
      'ROUTE_PROGRAMMING_IDENTITY_CONFLICT',
      'Usa identidades nuevas al adoptar asignaciones legadas.',
    );
  for (const entry of programmingIdentities(candidate)) {
    const old = known.find((row) => row.id === entry.id);
    if (
      old &&
      (old.routeSheetId !== context.routeSheetId ||
        old.cooperativeId !== context.cooperativeId ||
        old.kind !== entry.kind ||
        (['REQUIRED', 'SERVICE'].includes(entry.kind) &&
          (old.frequencyId !== entry.frequencyId || old.departureAt !== entry.departureAt)))
    )
      throw new RouteProgrammingConflictError(
        'ROUTE_PROGRAMMING_IDENTITY_CONFLICT',
        'Una identidad no puede cambiar de hoja, clase o salida comercial.',
      );
  }
}

module.exports = { programmingIdentities, assertProgrammingIdentities };
