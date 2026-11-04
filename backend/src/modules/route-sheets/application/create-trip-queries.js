const { tripUuid } = require('../domain/value-objects/commercial-inventory');
const restore = require('../domain/value-objects/restore-commercial-trip');
const evaluate = require('../domain/services/evaluate-commercial-trip');
const {
  CommercialTripValidationError,
  CommercialTripSourceError,
} = require('../domain/errors/commercial-trip-errors');

function createTripQueries({
  tripRepository,
  frequencyQueryPort,
  busQueryPort,
  now = () => new Date().toISOString(),
}) {
  async function query(tripId, segment, purchase = false) {
    const id = tripUuid(tripId);
    if (!tripRepository?.withSnapshot || !frequencyQueryPort?.findById || !busQueryPort?.findById)
      throw new CommercialTripSourceError();
    const snapshot = await tripRepository.withSnapshot(id, (value) => value);
    if (snapshot === null) return null;
    if (snapshot?.sheet?.status === 'DRAFT') return null;
    const data = restore(snapshot, id);
    if (segment && segment.toPosition >= data.points.length)
      throw new CommercialTripValidationError('El par queda fuera del recorrido.');
    if (data.sheet.status !== 'PUBLISHED') return null;
    const frequency = await frequencyQueryPort.findById(
      data.trip.frequencyId,
      data.trip.cooperativeId,
    );
    if (frequency === null) return null;
    if (
      !frequency ||
      frequency.id !== data.trip.frequencyId ||
      frequency.cooperativeId !== data.trip.cooperativeId ||
      !['ACTIVE', 'INACTIVE'].includes(frequency.status)
    )
      throw new CommercialTripSourceError();
    if (frequency.status !== 'ACTIVE') return null;
    const bus = await busQueryPort.findById(data.trip.busId, data.trip.cooperativeId);
    if (bus === null) return null;
    if (
      !bus ||
      bus.id !== data.trip.busId ||
      bus.cooperativeId !== data.trip.cooperativeId ||
      typeof bus.busGroupId !== 'string'
    )
      throw new CommercialTripSourceError();
    if (bus.busGroupId !== data.sheet.busGroupId) return null;
    const result = evaluate(data, now(), segment);
    return result && purchase ? Object.freeze({ ...result, seats: data.seats }) : result;
  }
  function segmentQuery(input, purchase = false) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).length !== 3 ||
      !['tripId', 'fromPosition', 'toPosition'].every((key) => Object.hasOwn(input, key)) ||
      !Number.isSafeInteger(input.fromPosition) ||
      input.fromPosition < 0 ||
      !Number.isSafeInteger(input.toPosition) ||
      input.toPosition <= input.fromPosition
    )
      return Promise.reject(
        new CommercialTripValidationError('Solo se permite tripId y un par válido de posiciones.'),
      );
    return query(
      input.tripId,
      {
        fromPosition: input.fromPosition,
        toPosition: input.toPosition,
      },
      purchase,
    );
  }
  return Object.freeze({
    findBookableById: (tripId) => query(tripId),
    findBookableForSegment: (input) => segmentQuery(input),
    findPurchaseContext: (input) => segmentQuery(input, true),
  });
}
module.exports = createTripQueries;
