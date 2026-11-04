const BookingLifecycleError = require('../domain/booking-lifecycle-error');
const fail = () => {
  throw new BookingLifecycleError('BOOKING_DATA_INTEGRITY_ERROR');
};
function instant(clock) {
  const now = clock();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail();
  return now.toISOString();
}
function candidates(rows, limit, cutoff) {
  if (!Array.isArray(rows) || rows.length > limit) fail();
  const copy = rows.map((row) => ({ bookingId: row?.bookingId, expiresAt: row?.expiresAt }));
  if (new Set(copy.map((row) => row.bookingId)).size !== copy.length) fail();
  for (const row of copy) {
    const time = typeof row.expiresAt === 'string' ? new Date(row.expiresAt) : null;
    if (
      typeof row.bookingId !== 'string' ||
      !row.bookingId.trim() ||
      !time ||
      !Number.isFinite(time.getTime()) ||
      time.toISOString() !== row.expiresAt ||
      time.getTime() > new Date(cutoff).getTime()
    )
      fail();
  }
  return copy;
}
module.exports = function expireDueBookings({
  reader,
  expireBooking,
  clock,
  batchSize,
  onFailure = () => {},
}) {
  let continuation = null;
  let inFlight = null;
  async function execute() {
    if (!continuation) continuation = { cutoff: instant(clock), after: null };
    const { cutoff, after } = continuation;
    const rows = candidates(
      await reader.listExpiredCandidates({ cutoff, after, limit: batchSize }),
      batchSize,
      cutoff,
    );
    const result = { scanned: rows.length, expired: 0, protected: 0, notDue: 0, failed: 0 };
    for (const row of rows) {
      try {
        const decision = await expireBooking({ bookingId: row.bookingId });
        if (decision?.outcome === 'EXPIRED') result.expired += 1;
        else if (decision?.outcome === 'PROOF_RECEIVED') result.protected += 1;
        else if (decision?.outcome === 'NOT_DUE') result.notDue += 1;
        else fail();
      } catch (error) {
        result.failed += 1;
        try {
          await onFailure(error);
        } catch {
          /* La observación no interrumpe el lote. */
        }
      }
    }
    continuation = rows.length === batchSize ? { cutoff, after: rows.at(-1) } : null;
    return Object.freeze({ ...result, continuing: continuation !== null });
  }
  return function runExpirationBatch() {
    if (!inFlight)
      inFlight = execute().finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
};
