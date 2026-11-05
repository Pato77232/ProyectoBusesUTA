const Failure = require('./benefit-request-error');
const FIELDS = ['seatId', 'birthDateVerified', 'disabilityVerified', 'evidence'];
const KINDS = ['IDENTITY', 'BIRTH_RECORD', 'DISABILITY'];
function invalid() {
  throw new Failure('BOOKING_BENEFIT_REQUEST_INVALID');
}
function closed(value, fields) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((k) => Object.hasOwn(value, k))
  );
}
function evidenceFor(value) {
  if (
    !closed(value, ['kind', 'reference']) ||
    !KINDS.includes(value.kind) ||
    typeof value.reference !== 'string' ||
    value.reference.length < 8 ||
    value.reference.length > 128 ||
    !value.reference.startsWith('ref_') ||
    /[^A-Za-z0-9_-]/.test(value.reference)
  )
    invalid();
  return Object.freeze({ kind: value.kind, reference: value.reference });
}
function decisionsFor(values) {
  if (!Array.isArray(values) || !values.length) invalid();
  const seen = new Set();
  const result = Array.from(values, (value) => {
    if (
      !closed(value, FIELDS) ||
      typeof value.seatId !== 'string' ||
      !value.seatId.trim() ||
      value.seatId !== value.seatId.trim() ||
      seen.has(value.seatId) ||
      typeof value.birthDateVerified !== 'boolean' ||
      typeof value.disabilityVerified !== 'boolean' ||
      !Array.isArray(value.evidence) ||
      value.evidence.length > 2
    )
      invalid();
    seen.add(value.seatId);
    const evidence = Array.from(value.evidence, evidenceFor).sort((a, b) =>
      a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0,
    );
    if (
      new Set(evidence.map((e) => e.kind)).size !== evidence.length ||
      evidence.filter((e) => e.kind === 'DISABILITY').length !==
        (value.disabilityVerified ? 1 : 0) ||
      evidence.filter((e) => e.kind !== 'DISABILITY').length !== (value.birthDateVerified ? 1 : 0)
    )
      invalid();
    return Object.freeze({
      seatId: value.seatId,
      birthDateVerified: value.birthDateVerified,
      disabilityVerified: value.disabilityVerified,
      evidence: Object.freeze(evidence),
    });
  }).sort((a, b) => (a.seatId < b.seatId ? -1 : a.seatId > b.seatId ? 1 : 0));
  return Object.freeze(result);
}
function reviewInput(value) {
  if (
    !closed(value, ['expectedRevision', 'decisions']) ||
    !Number.isInteger(value.expectedRevision) ||
    value.expectedRevision < 1 ||
    value.expectedRevision > 2147483647
  )
    invalid();
  return Object.freeze({
    expectedRevision: value.expectedRevision,
    decisions: decisionsFor(value.decisions),
  });
}
function proofDecisions(decisions) {
  return Object.freeze(
    decisions.map(({ seatId, birthDateVerified, disabilityVerified }) =>
      Object.freeze({ seatId, birthDateVerified, disabilityVerified }),
    ),
  );
}
function completedReview(row, identity) {
  if (row.status !== 'REVIEWED') return {};
  let decisions;
  try {
    decisions = decisionsFor(row.reviewDecisions);
  } catch {
    throw new Failure();
  }
  if (
    typeof row.reviewedBy !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(row.reviewedBy) ||
    row.reviewExpectedRevision !== 1 ||
    !/^[0-9a-f]{64}$/.test(row.reviewFingerprint) ||
    !/^[1-9][0-9]*$/.test(String(row.benefitReviewId)) ||
    !Number.isFinite(new Date(row.reviewedAt).getTime())
  )
    throw new Failure();
  return Object.freeze({
    review: Object.freeze({
      reviewedAt: new Date(row.reviewedAt).toISOString(),
      ...(identity.role === 'CLERK'
        ? { reviewedBy: row.reviewedBy, expectedRevision: row.reviewExpectedRevision }
        : {}),
      decisions: identity.role === 'CLERK' ? decisions : proofDecisions(decisions),
    }),
  });
}
module.exports = { reviewInput, decisionsFor, proofDecisions, completedReview };
