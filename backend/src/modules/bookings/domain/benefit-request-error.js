const ERRORS = Object.freeze({
  BOOKING_BENEFIT_REVIEW_CONFLICT: [409, 'La solicitud ya fue revisada o cambió su versión.'],
  BOOKING_BENEFIT_REVIEW_UNCERTAIN: [
    503,
    'No se pudo confirmar el resultado. Reintenta la misma revisión.',
  ],
  BOOKING_BENEFIT_REQUEST_INVALID: [400, 'Los datos de la solicitud no son válidos.'],
  BOOKING_BENEFIT_REQUEST_NOT_FOUND: [404, 'No se encontró la solicitud.'],
  BOOKING_BENEFIT_REQUEST_KEY_REUSED: [409, 'La clave de solicitud corresponde a otros datos.'],
  BOOKING_BENEFIT_REQUEST_UNAVAILABLE: [503, 'No se pudo completar la solicitud de acreditación.'],
  BOOKING_BENEFIT_REQUEST_INTEGRITY_ERROR: [
    500,
    'No se pudo verificar la solicitud de acreditación.',
  ],
  BOOKING_TRIP_UNAVAILABLE: [404, 'El viaje no admite esta solicitud.'],
  UNAUTHENTICATED: [401, 'Se requiere una sesión válida.'],
  FORBIDDEN: [403, 'No tienes permiso para esta operación.'],
});
class BenefitRequestError extends Error {
  constructor(code = 'BOOKING_BENEFIT_REQUEST_INTEGRITY_ERROR') {
    const safe = Object.hasOwn(ERRORS, code) ? code : 'BOOKING_BENEFIT_REQUEST_INTEGRITY_ERROR';
    super(ERRORS[safe][1]);
    this.name = 'BenefitRequestError';
    this.code = safe;
    this.httpStatus = ERRORS[safe][0];
  }
}
module.exports = BenefitRequestError;
