const factory = require('../../../src/modules/bookings/application/benefit-reviews');
const { randomUUID } = require('node:crypto');
const calendarDateAt = require('../../../src/modules/bookings/infrastructure/booking-clock');
const ownerId = randomUUID(),
  cooperativeId = randomUUID(),
  tripId = randomUUID(),
  seatId = randomUUID();
const actor = {
  sid: 'verified-session',
  user: { id: randomUUID(), role: 'CLERK', cooperative_id: cooperativeId },
};
const input = () => ({
  ownerId,
  tripId,
  fromPosition: 0,
  toPosition: 1,
  seatIds: [seatId],
  passengers: [
    { seatId, identificationNumber: '0100000009', fullName: 'Persona QA', birthDate: '1990-01-01' },
  ],
  decisions: [{ seatId, birthDateVerified: true, disabilityVerified: false }],
});
function setup() {
  let now = new Date('2030-01-01T10:00:00Z');
  const repository = { append: jest.fn(), findLatest: jest.fn() };
  const purchaseCatalog = {
    findPurchaseContext: jest.fn().mockResolvedValue({
      cooperativeId,
      boardingAt: '2030-01-01T12:00:00Z',
      seats: [{ seatId }],
    }),
  };
  return {
    repository,
    purchaseCatalog,
    setTime: (v) => {
      now = new Date(v);
    },
    service: factory({ repository, purchaseCatalog, clock: () => now, calendarDateAt }),
  };
}
test('conserva contexto exacto, actor y límite del embarque sin aceptar tenant del cliente', async () => {
  const s = setup(),
    body = input();
  expect(await s.service.review(body, actor)).toEqual({
    reviewedAt: '2030-01-01T10:00:00.000Z',
    expiresAt: '2030-01-01T12:00:00.000Z',
  });
  expect(s.repository.append).toHaveBeenCalledWith(
    expect.objectContaining({ actorId: actor.user.id, cooperativeId, decisions: body.decisions }),
  );
  await expect(s.service.review({ ...body, cooperativeId }, actor)).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
  });
});
test('rechaza actor ajeno, cliente y datos inválidos sin persistencia', async () => {
  const s = setup();
  await expect(
    s.service.review(input(), { ...actor, user: { ...actor.user, role: 'CUSTOMER' } }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  s.purchaseCatalog.findPurchaseContext.mockResolvedValue({ cooperativeId: randomUUID() });
  await expect(s.service.review(input(), actor)).rejects.toMatchObject({
    code: 'BOOKING_TRIP_UNAVAILABLE',
  });
  await expect(s.service.review({ ...input(), decisions: [] }, actor)).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
  });
  expect(s.repository.append).not.toHaveBeenCalled();
});
test('al vencer exactamente exige nueva revisión y un fallo técnico no acredita', async () => {
  const s = setup();
  s.repository.findLatest.mockResolvedValue({
    expiresAt: '2030-01-01T12:00:00Z',
    decisions: input().decisions,
  });
  expect(await s.service.verify(input())).toEqual(input().decisions);
  s.setTime('2030-01-01T12:00:00Z');
  await expect(s.service.verify(input())).rejects.toMatchObject({
    code: 'BOOKING_BENEFIT_REVIEW_REQUIRED',
  });
  s.repository.findLatest.mockResolvedValue(null);
  await expect(s.service.verify(input())).rejects.toMatchObject({
    code: 'BOOKING_BENEFIT_REVIEW_REQUIRED',
  });
  const failure = new Error('database unavailable');
  s.repository.findLatest.mockRejectedValue(failure);
  await expect(s.service.verify(input())).rejects.toBe(failure);
});
