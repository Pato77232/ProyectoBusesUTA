const { randomUUID } = require('node:crypto');
const {
  replayRecord,
} = require('../../../src/modules/route-sheets/infrastructure/repositories/renewal-records');

function receipt() {
  const row = {
    cooperative_id: randomUUID(),
    request_key: randomUUID(),
    source_route_sheet_id: randomUUID(),
    target_route_sheet_id: randomUUID(),
    series_id: randomUUID(),
    created_by: randomUUID(),
    source_programming_revision: 1,
    source_tariff_revision: 1,
    start_at: new Date('2030-01-02T05:00:00Z'),
    end_exclusive: new Date('2030-01-03T05:00:00Z'),
    created_at: new Date('2030-01-01T00:00:00Z'),
  };
  row.response = {
    routeSheetId: row.target_route_sheet_id,
    sourceRouteSheetId: row.source_route_sheet_id,
    seriesId: row.series_id,
    status: 'DRAFT',
    startAt: row.start_at.toISOString(),
    endExclusive: row.end_exclusive.toISOString(),
    cycleLengthDays: 1,
    programmingRevision: 1,
    tariffRevision: 1,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
  return row;
}

test('la ausencia y un recibo íntegro son resultados distintos', () => {
  expect(replayRecord(undefined)).toBeNull();
  const row = receipt();
  expect(replayRecord(row)).toMatchObject({
    renewal: row.response,
    request: { requestKey: row.request_key },
  });
});

test.each([
  'sourceRouteSheetId',
  'createdBy',
  'createdAt',
  'endExclusive',
  'status',
  'tariffRevision',
])('un recibo corrupto en %s falla cerrado', (field) => {
  const row = receipt();
  row.response[field] = 'dato corrupto';
  expect(() => replayRecord(row)).toThrow(
    expect.objectContaining({ code: 'ROUTE_RENEWAL_SOURCE_UNAVAILABLE', httpStatus: 503 }),
  );
});
