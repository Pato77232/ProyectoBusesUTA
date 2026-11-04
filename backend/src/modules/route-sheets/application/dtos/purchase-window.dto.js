class PurchaseWindowDTO {
  constructor({ maxPurchaseDaysAhead, cycleLengthWeeks, maxCycles = 2, validUntil }) {
    this.maxPurchaseDaysAhead = maxPurchaseDaysAhead;
    this.cycleLengthWeeks = cycleLengthWeeks;
    this.maxCycles = maxCycles;
    this.validUntil = validUntil;
  }
}

module.exports = PurchaseWindowDTO;
