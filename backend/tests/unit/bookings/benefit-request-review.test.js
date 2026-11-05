const { createHash } = require('node:crypto');
const factory = require('../../../src/modules/bookings/application/benefit-requests');
const contextKey = require('../../../src/modules/bookings/domain/benefit-review-context');
const Failure = require('../../../src/modules/bookings/domain/benefit-request-error');
const ids = {
  owner: '10000000-0000-4000-8000-000000000001',
  clerk: '20000000-0000-4000-8000-000000000001',
  other: '20000000-0000-4000-8000-000000000002',
  coop: '30000000-0000-4000-8000-000000000001',
  trip: '40000000-0000-4000-8000-000000000001',
  request: '50000000-0000-4000-8000-000000000001',
};
const clerk = {
  sid: 'qa-session',
  user: { id: ids.clerk, role: 'CLERK', cooperative_id: ids.coop },
};
const customer = {
  sid: 'qa-customer',
  user: { id: ids.owner, role: 'CUSTOMER', cooperative_id: null },
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const command = () => ({
  expectedRevision: 1,
  decisions: [
    {
      seatId: 'seat-1',
      birthDateVerified: true,
      disabilityVerified: true,
      evidence: [
        { kind: 'IDENTITY', reference: 'ref_identity_0001' },
        { kind: 'DISABILITY', reference: 'ref_disability_0001' },
      ],
    },
  ],
});
function harness() {
  let now = new Date('2026-11-04T14:00:00.000Z');
  let locked = false;
  const purchase = {
    tripId: ids.trip,
    fromPosition: 0,
    toPosition: 1,
    seatIds: ['seat-1'],
    passengers: [
      {
        seatId: 'seat-1',
        fullName: 'Persona QA',
        identificationNumber: '0100000009',
        birthDate: '1990-01-01',
      },
    ],
  };
  const row = {
    id: ids.request,
    ownerId: ids.owner,
    cooperativeId: ids.coop,
    tripId: ids.trip,
    fromPosition: 0,
    toPosition: 1,
    purchase,
    fingerprint: hash(contextKey({ ...purchase, ownerId: ids.owner })),
    status: 'PENDING',
    revision: 1,
    journey: { fromPlace: 'Ambato', toPlace: 'Quito' },
    passengerCount: 1,
    createdAt: new Date('2026-11-04T13:00:00Z'),
    expiresAt: new Date('2030-01-01T12:00:00Z'),
  };
  const complete = jest.fn(async (value) => {
    Object.assign(row, {
      status: 'REVIEWED',
      revision: 2,
      reviewedAt: value.reviewedAt,
      reviewedBy: value.actorId,
      reviewFingerprint: value.intent,
      reviewExpectedRevision: value.expectedRevision,
      reviewDecisions: JSON.parse(JSON.stringify(value.decisions)),
      benefitReviewId: '1',
    });
    return JSON.parse(JSON.stringify(row));
  });
  const repository = {
    get: jest.fn(async () => JSON.parse(JSON.stringify(row))),
    withLockedRequest: jest.fn(async (_scope, operation) => {
      locked = true;
      try {
        return await operation(JSON.parse(JSON.stringify(row)), { complete });
      } finally {
        locked = false;
      }
    }),
  };
  const purchaseCatalog = {
    findPurchaseContext: jest.fn(async () => {
      expect(locked).toBe(false);
      return {
        tripId: ids.trip,
        cooperativeId: ids.coop,
        fromPosition: 0,
        toPosition: 1,
        boardingAt: row.expiresAt.toISOString(),
        seats: [{ seatId: 'seat-1' }],
      };
    }),
  };
  const api = factory({
    repository,
    purchaseCatalog,
    clock: () => now,
    calendarDateAt: (date) => date.toISOString().slice(0, 10),
    newId: () => ids.request,
    fingerprint: hash,
  });
  return {
    api,
    row,
    repository,
    complete,
    purchaseCatalog,
    now: (value) => {
      now = value;
    },
  };
}
test('persiste decisiones reales y evidencia privada con resultado versionado', async () => {
  const h = harness();
  const result = await h.api.review(ids.request, command(), clerk);
  expect(result).toMatchObject({
    requestId: ids.request,
    status: 'REVIEWED',
    revision: 2,
    review: { reviewedBy: ids.clerk, expectedRevision: 1 },
  });
  expect(result.review.decisions[0].evidence).toHaveLength(2);
  expect(Object.isFrozen(result.review.decisions[0].evidence[0])).toBe(true);
  expect(h.complete.mock.calls[0][0].proofDecisions).toEqual([
    { seatId: 'seat-1', birthDateVerified: true, disabilityVerified: true },
  ]);
  expect(h.repository.withLockedRequest).toHaveBeenCalledWith(
    { id: ids.request, cooperativeId: ids.coop },
    expect.any(Function),
  );
});
test('mismo intento con orden distinto recupera resultado sin escribir ni consultar catálogo al vencer', async () => {
  const h = harness();
  const first = await h.api.review(ids.request, command(), clerk);
  const replay = command();
  replay.decisions[0].evidence.reverse();
  h.now(new Date(h.row.expiresAt));
  const result = await h.api.review(ids.request, replay, clerk);
  expect(result.status).toBe('EXPIRED');
  expect(result.review).toEqual(first.review);
  expect(h.complete).toHaveBeenCalledTimes(1);
  expect(h.purchaseCatalog.findPurchaseContext).toHaveBeenCalledTimes(1);
});
test.each(['actor', 'revision', 'content'])(
  'intento diferente por %s no sobrescribe resultado',
  async (kind) => {
    const h = harness();
    await h.api.review(ids.request, command(), clerk);
    const input = command();
    let actor = clerk;
    if (kind === 'actor') actor = { ...clerk, user: { ...clerk.user, id: ids.other } };
    if (kind === 'revision') input.expectedRevision = 2;
    if (kind === 'content') input.decisions[0].evidence[0].reference = 'ref_other_identity';
    await expect(h.api.review(ids.request, input, actor)).rejects.toMatchObject({
      code: 'BOOKING_BENEFIT_REVIEW_CONFLICT',
      httpStatus: 409,
    });
    expect(h.complete).toHaveBeenCalledTimes(1);
  },
);
const invalidCommands = [
  null,
  {},
  [],
  { ...command(), ownerId: ids.owner },
  { ...command(), expectedRevision: 0 },
  { ...command(), expectedRevision: '1' },
  { ...command(), decisions: [] },
  { ...command(), decisions: [{ ...command().decisions[0], evidence: [] }] },
  { ...command(), decisions: [{ ...command().decisions[0], disabilityVerified: false }] },
  { ...command(), decisions: [{ ...command().decisions[0], birthDateVerified: false }] },
  {
    ...command(),
    decisions: [
      {
        ...command().decisions[0],
        evidence: [{ kind: 'IDENTITY', reference: 'https://private/file' }],
      },
    ],
  },
  {
    ...command(),
    decisions: [
      { ...command().decisions[0], evidence: [{ kind: 'IDENTITY', reference: 'ref_ok_0001\n' }] },
    ],
  },
  {
    ...command(),
    decisions: [
      {
        ...command().decisions[0],
        evidence: [{ kind: 'IDENTITY', reference: 'ref_ok_0001', file: 'secret' }],
      },
    ],
  },
  { ...command(), decisions: [command().decisions[0], command().decisions[0]] },
];
test.each(invalidCommands)('comando inválido no consulta datos: %j', async (input) => {
  const h = harness();
  await expect(h.api.review(ids.request, input, clerk)).rejects.toMatchObject({ httpStatus: 400 });
  expect(h.repository.get).not.toHaveBeenCalled();
  expect(h.complete).not.toHaveBeenCalled();
});
test.each([null, customer, { ...clerk, user: { ...clerk.user, role: 'COOPERATIVE_ADMIN' } }])(
  'rol no autorizado no lee solicitud',
  async (actor) => {
    const h = harness();
    await expect(h.api.review(ids.request, command(), actor)).rejects.toMatchObject({
      httpStatus: actor ? 403 : 401,
    });
    expect(h.repository.get).not.toHaveBeenCalled();
  },
);
test('solicitud ajena y ausente no filtran información', async () => {
  const h = harness();
  h.repository.get.mockResolvedValueOnce(null);
  await expect(h.api.review(ids.request, command(), clerk)).rejects.toMatchObject({
    httpStatus: 404,
  });
  h.row.cooperativeId = ids.owner;
  await expect(h.api.review(ids.request, command(), clerk)).rejects.toMatchObject({
    httpStatus: 404,
  });
  expect(h.complete).not.toHaveBeenCalled();
});
test('edad no acreditada se guarda como tal sin evidencia ficticia', async () => {
  const h = harness();
  const input = {
    expectedRevision: 1,
    decisions: [
      { seatId: 'seat-1', birthDateVerified: false, disabilityVerified: false, evidence: [] },
    ],
  };
  const result = await h.api.review(ids.request, input, clerk);
  expect(result.status).toBe('REVIEWED');
  expect(result.review.decisions[0].birthDateVerified).toBe(false);
});
test('propietario ve solo sus decisiones y CLERK conserva evidencia privada', async () => {
  const h = harness();
  await h.api.review(ids.request, command(), clerk);
  const own = await h.api.get(ids.request, customer);
  expect(own.review.decisions).toEqual([
    { seatId: 'seat-1', birthDateVerified: true, disabilityVerified: true },
  ]);
  expect(JSON.stringify(own)).not.toMatch(
    /ref_identity|ref_disability|reviewedBy|benefitReviewId|0100000009/,
  );
  const detail = await h.api.get(ids.request, clerk);
  expect(detail.review.reviewedBy).toBe(ids.clerk);
  expect(detail.review.decisions[0].evidence).toHaveLength(2);
});
test('vencimiento exacto o fuente no disponible impide guardar, sin ampliar plazo', async () => {
  const h = harness();
  h.now(new Date(h.row.expiresAt));
  await expect(h.api.review(ids.request, command(), clerk)).rejects.toMatchObject({
    code: 'BOOKING_TRIP_UNAVAILABLE',
  });
  expect(h.complete).not.toHaveBeenCalled();
  h.now(new Date('2026-11-04T14:00:00Z'));
  h.purchaseCatalog.findPurchaseContext.mockRejectedValue(
    Object.assign(new Error('SQL privado'), { code: 'ECONNRESET' }),
  );
  await expect(h.api.review(ids.request, command(), clerk)).rejects.toMatchObject({
    httpStatus: 503,
  });
  expect(h.complete).not.toHaveBeenCalled();
});
test('respuesta perdida recupera la revisión persistida con la misma intención', async () => {
  const h = harness();
  const normal = h.repository.withLockedRequest.getMockImplementation();
  h.repository.withLockedRequest.mockImplementationOnce(async (...args) => {
    await normal(...args);
    throw new Failure('BOOKING_BENEFIT_REVIEW_UNCERTAIN');
  });
  await expect(h.api.review(ids.request, command(), clerk)).rejects.toMatchObject({
    code: 'BOOKING_BENEFIT_REVIEW_UNCERTAIN',
    httpStatus: 503,
  });
  expect((await h.api.review(ids.request, command(), clerk)).revision).toBe(2);
  expect(h.complete).toHaveBeenCalledTimes(1);
});

test('snapshot persistido con huella incoherente falla como integridad y no guarda', async () => {
  const h = harness();
  h.row.fingerprint = 'd'.repeat(64);
  await expect(h.api.review(ids.request, command(), clerk)).rejects.toMatchObject({
    code: 'BOOKING_BENEFIT_REQUEST_INTEGRITY_ERROR',
    httpStatus: 500,
  });
  expect(h.complete).not.toHaveBeenCalled();
  expect(h.purchaseCatalog.findPurchaseContext).not.toHaveBeenCalled();
});
