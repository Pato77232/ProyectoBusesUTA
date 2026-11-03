class BookingPurchaseError extends Error {
  constructor(code) {
    const messages = {
      BOOKING_SUMMARY_CHANGED: 'El resumen cambió. Revísalo y vuelve a aceptarlo.',
      BOOKING_BENEFIT_REVIEW_REQUIRED:
        'La tarifa preferencial requiere revisión de su acreditación.',
    };
    super(messages[code]);
    this.name = 'BookingPurchaseError';
    this.code = code;
  }
}
module.exports = BookingPurchaseError;
