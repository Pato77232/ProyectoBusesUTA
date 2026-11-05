// BOOK-CAJA-02: errores del cobro en efectivo de boletería. No revelan datos de otra cooperativa.
const MESSAGES = Object.freeze({
  BOOKING_CASH_NOT_FOUND: 'No encontramos esta reserva de boletería.',
  BOOKING_CASH_CONFLICT:
    'La reserva no admite este cobro: revisa el importe, su estado o el recibo usado.',
  BOOKING_CASH_EXPIRED: 'El plazo para cobrar esta reserva terminó y los asientos se liberaron.',
  BOOKING_CASH_UNCERTAIN:
    'No pudimos confirmar el cobro. Reintenta con el mismo recibo antes de cobrar otra vez.',
});

class BookingCashError extends Error {
  constructor(code = 'BOOKING_CASH_UNCERTAIN') {
    const safe = Object.hasOwn(MESSAGES, code) ? code : 'BOOKING_CASH_UNCERTAIN';
    super(MESSAGES[safe]);
    this.name = 'BookingCashError';
    this.code = safe;
  }
}

module.exports = BookingCashError;
