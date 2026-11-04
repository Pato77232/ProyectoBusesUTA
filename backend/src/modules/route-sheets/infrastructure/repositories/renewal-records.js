const { RenewalSourceError } = require('../../domain/errors/route-renewal-errors');
const { readRenewalRequest } = require('../../domain/value-objects/renewal-request');
const { parseProgrammingRequest } = require('../../domain/value-objects/programming-request');
const restoreTariff = require('../../domain/value-objects/restore-tariff-snapshot');

function canonicalProgramming(programming, tariff) {
  try {
    const routes = new Map(tariff.frequencies.map((f) => [f.frequencyId, f.routePoints]));
    return parseProgrammingRequest({
      expectedRevision: 0,
      programming: {
        cycleStartDate: programming.cycleStartDate,
        cycleLengthDays: programming.cycleLengthDays,
        requiredServices: programming.requiredServices,
        agendas: programming.agendas.map((a) => ({
          busId: a.busId,
          initialAvailability: a.initialAvailability,
          blocks: a.blocks.map(({ id, kind, startAt, endAt, reason }) => ({
            id,
            kind,
            startAt,
            endAt,
            reason,
          })),
          activities: a.activities.map((v) => {
            const base = {
              id: v.id,
              kind: v.kind,
              departureAt: v.departureAt,
              arrivalAt: v.arrivalAt,
              preparationMinutes: v.preparationMinutes,
            };
            if (v.kind === 'TRANSFER')
              return { ...base, originKey: v.originKey, destinationKey: v.destinationKey };
            if (
              JSON.stringify(v.points.map((p) => p.locationKey)) !==
              JSON.stringify(routes.get(v.frequencyId))
            )
              throw new RenewalSourceError();
            return {
              ...base,
              frequencyId: v.frequencyId,
              requiredServiceId: v.requiredServiceId,
              points: v.points.map(({ position, arrivalAt, departureAt }) => ({
                position,
                ...(arrivalAt ? { arrivalAt } : {}),
                ...(departureAt ? { departureAt } : {}),
              })),
            };
          }),
        })),
      },
    }).programming;
  } catch {
    throw new RenewalSourceError();
  }
}

function sourceSnapshot(sheet, record, manifest) {
  if (!record || !manifest) throw new RenewalSourceError();
  const tariff = restoreTariff(sheet.tariff_frozen, sheet.tariff_frozen_revision);
  return {
    routeSheetId: sheet.id,
    cooperativeId: sheet.cooperative_id,
    busGroupId: sheet.bus_group_id,
    status: sheet.status,
    programmingRevision: record.revision,
    tariffRevision: sheet.tariff_frozen_revision,
    seriesId: manifest.seriesId,
    programming: canonicalProgramming(record.programming, tariff),
    tariff,
  };
}

function replayRecord(row) {
  if (!row) return null;
  try {
    const request = readRenewalRequest({
      sourceRouteSheetId: row.source_route_sheet_id,
      expectedProgrammingRevision: row.source_programming_revision,
      expectedTariffRevision: row.source_tariff_revision,
      requestKey: row.request_key,
    });
    const startAt = new Date(row.start_at).toISOString();
    const endExclusive = new Date(row.end_exclusive).toISOString();
    const cycleLengthDays = (Date.parse(endExclusive) - Date.parse(startAt)) / 86_400_000;
    const expected = {
      routeSheetId: row.target_route_sheet_id,
      sourceRouteSheetId: row.source_route_sheet_id,
      seriesId: row.series_id,
      status: 'DRAFT',
      startAt,
      endExclusive,
      cycleLengthDays,
      programmingRevision: 1,
      tariffRevision: 1,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at).toISOString(),
    };
    if (
      !Number.isSafeInteger(cycleLengthDays) ||
      cycleLengthDays < 1 ||
      !row.response ||
      Object.keys(row.response).length !== Object.keys(expected).length ||
      Object.entries(expected).some(([key, value]) => row.response[key] !== value)
    )
      throw new RenewalSourceError();
    return { request, renewal: row.response };
  } catch {
    throw new RenewalSourceError();
  }
}

module.exports = { sourceSnapshot, replayRecord, canonicalProgramming };
