const { uuid } = require('../../domain/value-objects/programming-request');
const { ProgrammingSourceError } = require('../../domain/errors/programming-persistence-errors');
function sourceId(value) {
  try {
    return uuid(value);
  } catch {
    throw new ProgrammingSourceError();
  }
}
function getRouteSheetEditor({
  editorRepository,
  busQueryPort,
  busGroupQueryPort,
  frequencyQueryPort,
}) {
  return async ({ routeSheetId, cooperativeId }) => {
    const context = { routeSheetId: uuid(routeSheetId), cooperativeId: uuid(cooperativeId) };
    const snapshot = await editorRepository.findSnapshot(context);
    const { sheet } = snapshot;
    if (sheet.id !== context.routeSheetId || sheet.cooperativeId !== context.cooperativeId)
      throw new ProgrammingSourceError();
    const group = await busGroupQueryPort.findById(sheet.busGroupId, context.cooperativeId);
    if (
      !group ||
      group.id !== sheet.busGroupId ||
      group.cooperative_id !== context.cooperativeId ||
      typeof group.name !== 'string' ||
      !group.name.trim()
    )
      throw new ProgrammingSourceError();
    const buses = await busQueryPort.findByBusGroupId(sheet.busGroupId, context.cooperativeId);
    const active = await frequencyQueryPort.findActiveByCooperativeId(context.cooperativeId);
    if (
      !Array.isArray(buses) ||
      !Array.isArray(active) ||
      buses.some(
        (bus) =>
          !bus ||
          bus.cooperativeId !== context.cooperativeId ||
          bus.busGroupId !== sheet.busGroupId ||
          typeof bus.plate !== 'string' ||
          !bus.plate.trim() ||
          !Number.isSafeInteger(bus.unitNumber) ||
          bus.unitNumber < 1,
      ) ||
      active.some((frequency) => !frequency || frequency.cooperativeId !== context.cooperativeId)
    )
      throw new ProgrammingSourceError();
    buses.forEach((bus) => sourceId(bus.id));
    active.forEach((frequency) => sourceId(frequency.id));
    if (
      new Set(buses.map((bus) => bus.id)).size !== buses.length ||
      new Set(active.map((f) => f.id)).size !== active.length
    )
      throw new ProgrammingSourceError();
    const referenced = snapshot.programming.programming?.requiredServices ?? [];
    const tariffs = snapshot.tariff.tariff?.frequencies ?? [];
    const ids = [
      ...new Set([
        ...active.map((f) => f.id),
        ...referenced.map((s) => s.frequencyId),
        ...tariffs.map((t) => t.frequencyId),
      ]),
    ];
    const frequencies = [];
    for (const id of ids) {
      const detail = await frequencyQueryPort.findWithStops(sourceId(id), context.cooperativeId);
      if (
        !detail ||
        detail.id !== id ||
        detail.cooperativeId !== context.cooperativeId ||
        !Array.isArray(detail.stops) ||
        !['ACTIVE', 'INACTIVE'].includes(detail.status) ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(detail.departureTime) ||
        [detail.origin, detail.destination, detail.antResolutionNumber, ...detail.stops].some(
          (v) => typeof v !== 'string' || !v.trim(),
        )
      )
        throw new ProgrammingSourceError();
      frequencies.push({ ...detail, stops: [...detail.stops] });
    }
    return {
      ...snapshot,
      sheet: { ...sheet, busGroupName: group.name },
      buses: buses.map(({ id, plate, unitNumber, cooperativeId, busGroupId }) => ({
        id,
        plate,
        unitNumber,
        cooperativeId,
        busGroupId,
      })),
      frequencies,
    };
  };
}
module.exports = getRouteSheetEditor;
