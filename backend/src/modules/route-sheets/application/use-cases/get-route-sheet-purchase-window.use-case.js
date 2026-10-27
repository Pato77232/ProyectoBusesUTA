const PurchaseWindowDTO = require('../dtos/purchase-window.dto');

function getRouteSheetPurchaseWindowUseCase({ routeSheetRepository, routeSheetCycleRepository }) {
  return async ({ cooperativeId, busGroupId }) => {
    const cycleLengthWeeks = 2;
    const maxCycles = 2;
    const maxPurchaseDaysAhead = cycleLengthWeeks * 7 * maxCycles;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + maxPurchaseDaysAhead);

    return new PurchaseWindowDTO({
      maxPurchaseDaysAhead,
      cycleLengthWeeks,
      maxCycles,
      validUntil,
    });
  };
}

module.exports = getRouteSheetPurchaseWindowUseCase;
