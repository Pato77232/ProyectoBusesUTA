const { RenewalValidationError, RenewalConflictError } = require('../errors/route-renewal-errors');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REVISION = 2_147_483_646;
const FIELDS = [
  'sourceRouteSheetId',
  'expectedProgrammingRevision',
  'expectedTariffRevision',
  'requestKey',
];

function renewalUuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new RenewalValidationError();
  return value.toLowerCase();
}

function readRenewalRequest(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !FIELDS.includes(key)) ||
    FIELDS.some((key) => !Object.hasOwn(value, key)) ||
    ![value.expectedProgrammingRevision, value.expectedTariffRevision].every(
      (revision) => Number.isInteger(revision) && revision > 0 && revision <= MAX_REVISION,
    )
  )
    throw new RenewalValidationError();
  return Object.freeze({
    sourceRouteSheetId: renewalUuid(value.sourceRouteSheetId),
    expectedProgrammingRevision: value.expectedProgrammingRevision,
    expectedTariffRevision: value.expectedTariffRevision,
    requestKey: renewalUuid(value.requestKey),
  });
}

// Comparar el registro durable antes de volver a validar fecha/cupo de un reintento.
function assertSameRenewalRequest(request, previous) {
  const saved = readRenewalRequest(previous);
  if (FIELDS.some((field) => request[field] !== saved[field]))
    throw new RenewalConflictError(
      'ROUTE_RENEWAL_REQUEST_CONFLICT',
      'La clave o el destino de renovación ya corresponde a otra solicitud.',
    );
}

module.exports = { renewalUuid, readRenewalRequest, assertSameRenewalRequest };
