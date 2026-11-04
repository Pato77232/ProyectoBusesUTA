const {
  readRenewalRequest,
  renewalUuid,
  assertSameRenewalRequest,
} = require('../../domain/value-objects/renewal-request');
const planRenewal = require('../../domain/services/plan-route-sheet-renewal');
const prepareProgramming = require('../services/prepare-route-programming');
const {
  RenewalConflictError,
  RenewalSourceError,
  RenewalForbiddenError,
} = require('../../domain/errors/route-renewal-errors');

function prepareRouteSheetRenewal({ renewalRepository, busQueryPort, now, newId }) {
  return async (input, actor) => {
    if (actor?.role !== 'COOPERATIVE_ADMIN') throw new RenewalForbiddenError();
    const request = readRenewalRequest(input);
    const context = {
      cooperativeId: renewalUuid(actor.cooperative_id),
      modifiedBy: renewalUuid(actor.id),
      sourceRouteSheetId: request.sourceRouteSheetId,
    };
    if (!renewalRepository?.withLockedRenewal || typeof now !== 'function')
      throw new RenewalSourceError();
    return renewalRepository.withLockedRenewal(context, async (session) => {
      const previous = await session.findReplay(request.requestKey);
      if (previous) {
        assertSameRenewalRequest(request, previous.request);
        return { renewal: previous.renewal, replayed: true };
      }
      const snapshot = await session.readSnapshot();
      const plan = planRenewal({ request, context, ...snapshot, now: now(), newId });
      if (await session.findTarget(plan.seriesId, plan.startAt))
        throw new RenewalConflictError(
          'ROUTE_RENEWAL_TARGET_CONFLICT',
          'El siguiente ciclo ya tiene un borrador de renovación.',
        );
      const candidate = await prepareProgramming({
        programming: plan.draft.programming,
        cooperativeId: context.cooperativeId,
        busGroupId: plan.draft.busGroupId,
        busQueryPort,
        frequencyQueryPort: session.frequencyQueryPort,
      });
      for (const agenda of candidate.agendas)
        for (const activity of agenda.activities) {
          if (activity.kind !== 'SERVICE') continue;
          const route = plan.draft.tariff.frequencies.find(
            (v) => v.frequencyId === activity.frequencyId,
          );
          if (
            JSON.stringify(activity.points.map((p) => p.locationKey)) !==
            JSON.stringify(route?.routePoints)
          )
            throw new RenewalConflictError(
              'ROUTE_RENEWAL_ROUTE_CHANGED',
              'El recorrido cambió respecto de la tarifa del origen.',
            );
        }
      return session.save(plan, candidate);
    });
  };
}

module.exports = prepareRouteSheetRenewal;
