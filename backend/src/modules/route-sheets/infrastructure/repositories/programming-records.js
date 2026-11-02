const { programmingIdentities } = require('../../domain/value-objects/programming-identities');
const { RouteProgrammingConflictError } = require('../../domain/errors/route-programming-errors');
const MILLISECONDS_PER_MINUTE = 60_000;
const iso = (value) =>
  value === null || value === undefined ? undefined : new Date(value).toISOString();
const date = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value);

async function readProgramming(client, routeSheetId, cooperativeId) {
  const params = [routeSheetId, cooperativeId];
  const { rows: headers } = await client.query(
    `SELECT p.*,to_char(p.cycle_start_date,'YYYY-MM-DD') AS cycle_start_date,s.bus_group_id
     FROM route_sheet_programmings p JOIN route_sheets s ON s.id=p.route_sheet_id AND s.cooperative_id=p.cooperative_id
     WHERE p.route_sheet_id=$1 AND p.cooperative_id=$2`,
    params,
  );
  const header = headers[0];
  if (!header) return null;
  const { rows: required } = await client.query(
    'SELECT * FROM route_sheet_required_services WHERE route_sheet_id=$1 AND cooperative_id=$2 ORDER BY departure_at,id',
    params,
  );
  const { rows: buses } = await client.query(
    'SELECT * FROM route_sheet_bus_availability WHERE route_sheet_id=$1 AND cooperative_id=$2 ORDER BY bus_id',
    params,
  );
  const { rows: assignments } = await client.query(
    'SELECT * FROM route_sheet_assignments WHERE route_sheet_id=$1 AND cooperative_id=$2 ORDER BY departure_at,id',
    params,
  );
  const { rows: points } = await client.query(
    'SELECT * FROM route_sheet_service_points WHERE route_sheet_id=$1 AND cooperative_id=$2 ORDER BY position',
    params,
  );
  const { rows: transfers } = await client.query(
    'SELECT * FROM route_sheet_transfers WHERE route_sheet_id=$1 AND cooperative_id=$2 ORDER BY departure_at,id',
    params,
  );
  const { rows: blocks } = await client.query(
    'SELECT * FROM route_sheet_programming_blocks WHERE route_sheet_id=$1 AND cooperative_id=$2 ORDER BY start_at,id',
    params,
  );
  const activity = (row, kind) => ({
    id: row.id,
    cooperativeId,
    busId: row.bus_id,
    kind,
    departureAt: iso(row.departure_at),
    arrivalAt: iso(row.arrival_at),
    preparationMinutes: Number(row.preparation_minutes),
    readyAt: iso(
      new Date(row.arrival_at).getTime() +
        Number(row.preparation_minutes) * MILLISECONDS_PER_MINUTE,
    ),
    ...(kind === 'SERVICE'
      ? {
          frequencyId: row.frequency_id,
          requiredServiceId: row.required_service_id,
          points: points
            .filter((p) => p.assignment_id === row.id)
            .map((p) => ({
              position: p.position,
              locationKey: p.location_key,
              ...(p.arrival_at ? { arrivalAt: iso(p.arrival_at) } : {}),
              ...(p.departure_at ? { departureAt: iso(p.departure_at) } : {}),
            })),
          originKey: points.find((p) => p.assignment_id === row.id && p.position === 0)
            ?.location_key,
          destinationKey: points.filter((p) => p.assignment_id === row.id).at(-1)?.location_key,
        }
      : { frequencyId: null, originKey: row.origin_key, destinationKey: row.destination_key }),
  });
  return {
    routeSheetId,
    cooperativeId,
    revision: header.revision,
    updatedBy: header.updated_by,
    updatedAt: iso(header.updated_at),
    programming: {
      schemaVersion: header.schema_version,
      busGroupId: header.bus_group_id,
      cooperativeId,
      cycleStartDate: date(header.cycle_start_date),
      cycleLengthDays: header.cycle_length_days,
      startAt: iso(header.start_at),
      endExclusive: iso(header.end_exclusive),
      requiredServices: required.map((r) => ({
        id: r.id,
        frequencyId: r.frequency_id,
        departureAt: iso(r.departure_at),
      })),
      agendas: buses.map((bus) => ({
        busId: bus.bus_id,
        cooperativeId,
        busGroupId: header.bus_group_id,
        initialAvailability: { availableAt: iso(bus.available_at), locationKey: bus.location_key },
        activities: [
          ...assignments.filter((r) => r.bus_id === bus.bus_id).map((r) => activity(r, 'SERVICE')),
          ...transfers.filter((r) => r.bus_id === bus.bus_id).map((r) => activity(r, 'TRANSFER')),
        ].sort((a, b) => Date.parse(a.departureAt) - Date.parse(b.departureAt)),
        blocks: blocks
          .filter((r) => r.bus_id === bus.bus_id)
          .map((r) => ({
            id: r.id,
            cooperativeId,
            busId: r.bus_id,
            kind: r.kind,
            startAt: iso(r.start_at),
            endAt: iso(r.end_at),
            reason: r.reason,
          })),
      })),
    },
  };
}

async function writeProgramming(client, context, candidate, revision) {
  const { routeSheetId, cooperativeId, modifiedBy } = context;
  const previous = await readProgramming(client, routeSheetId, cooperativeId);
  const params = [routeSheetId, cooperativeId];
  await client.query("SELECT set_config('busesuta.programming_write','on',true)");
  await client.query(
    `INSERT INTO route_sheet_programmings(route_sheet_id,cooperative_id,revision,schema_version,cycle_start_date,cycle_length_days,start_at,end_exclusive,updated_by)
    VALUES($1,$2,$3,1,$4,$5,$6,$7,$8) ON CONFLICT(route_sheet_id) DO UPDATE SET revision=EXCLUDED.revision,
    cycle_start_date=EXCLUDED.cycle_start_date,cycle_length_days=EXCLUDED.cycle_length_days,start_at=EXCLUDED.start_at,end_exclusive=EXCLUDED.end_exclusive,
    updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP`,
    [
      routeSheetId,
      cooperativeId,
      revision,
      candidate.cycleStartDate,
      candidate.cycleLengthDays,
      candidate.startAt,
      candidate.endExclusive,
      modifiedBy,
    ],
  );
  // El libro de identidades retiene las retiradas: no reciclar identidades comerciales.
  for (const row of programmingIdentities(candidate)) {
    const inserted = await client.query(
      `INSERT INTO route_sheet_programming_ids(id,route_sheet_id,cooperative_id,kind,frequency_id,departure_at)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
      [
        row.id,
        routeSheetId,
        cooperativeId,
        row.kind,
        row.frequencyId ?? null,
        row.departureAt ?? null,
      ],
    );
    if (!inserted.rowCount) {
      const existing = await client.query(
        'SELECT id FROM route_sheet_programming_ids WHERE id=$1 AND route_sheet_id=$2 AND cooperative_id=$3',
        [row.id, routeSheetId, cooperativeId],
      );
      if (!existing.rows.length)
        throw new RouteProgrammingConflictError(
          'ROUTE_PROGRAMMING_IDENTITY_CONFLICT',
          'El identificador no está disponible para esta hoja.',
        );
    }
  }
  for (const table of [
    'route_sheet_assignments',
    'route_sheet_rest_days',
    'route_sheet_required_services',
    'route_sheet_transfers',
    'route_sheet_programming_blocks',
    'route_sheet_bus_availability',
  ]) {
    await client.query(
      `DELETE FROM ${table} WHERE route_sheet_id=$1 AND cooperative_id=$2`,
      params,
    );
  }
  for (const service of candidate.requiredServices) {
    await client.query(
      'INSERT INTO route_sheet_required_services(id,route_sheet_id,cooperative_id,frequency_id,departure_at) VALUES($1,$2,$3,$4,$5)',
      [service.id, routeSheetId, cooperativeId, service.frequencyId, service.departureAt],
    );
  }
  for (const agenda of candidate.agendas) {
    await client.query(
      'INSERT INTO route_sheet_bus_availability(route_sheet_id,cooperative_id,bus_id,available_at,location_key) VALUES($1,$2,$3,$4,$5)',
      [
        routeSheetId,
        cooperativeId,
        agenda.busId,
        agenda.initialAvailability.availableAt,
        agenda.initialAvailability.locationKey,
      ],
    );
    for (const row of agenda.activities) {
      if (row.kind === 'SERVICE') {
        await client.query(
          `INSERT INTO route_sheet_assignments(id,route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id,required_service_id,departure_at,arrival_at,preparation_minutes)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            row.id,
            routeSheetId,
            cooperativeId,
            candidate.busGroupId,
            agenda.busId,
            row.frequencyId,
            row.requiredServiceId,
            row.departureAt,
            row.arrivalAt,
            row.preparationMinutes,
          ],
        );
        for (const point of row.points) {
          await client.query(
            'INSERT INTO route_sheet_service_points(assignment_id,route_sheet_id,cooperative_id,position,location_key,arrival_at,departure_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [
              row.id,
              routeSheetId,
              cooperativeId,
              point.position,
              point.locationKey,
              point.arrivalAt ?? null,
              point.departureAt ?? null,
            ],
          );
        }
      } else {
        await client.query(
          'INSERT INTO route_sheet_transfers(id,route_sheet_id,cooperative_id,bus_id,origin_key,destination_key,departure_at,arrival_at,preparation_minutes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [
            row.id,
            routeSheetId,
            cooperativeId,
            agenda.busId,
            row.originKey,
            row.destinationKey,
            row.departureAt,
            row.arrivalAt,
            row.preparationMinutes,
          ],
        );
      }
    }
    for (const block of agenda.blocks) {
      await client.query(
        'INSERT INTO route_sheet_programming_blocks(id,route_sheet_id,cooperative_id,bus_id,kind,start_at,end_at,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          block.id,
          routeSheetId,
          cooperativeId,
          agenda.busId,
          block.kind,
          block.startAt,
          block.endAt,
          block.reason,
        ],
      );
    }
  }
  await client.query(
    `INSERT INTO route_sheet_modification_logs(route_sheet_id,cooperative_id,bus_group_id,modified_by,reason,action,affected_entity,entity_id,old_value,new_value)
    VALUES($1,$2,$3,$4,'Reemplazo integral de programación','PROGRAMMING_SAVE','PROGRAMMING',$1,$5::jsonb,$6::jsonb)`,
    [
      routeSheetId,
      cooperativeId,
      candidate.busGroupId,
      modifiedBy,
      JSON.stringify({ revision: revision - 1, programming: previous?.programming ?? null }),
      JSON.stringify({ revision, programming: candidate }),
    ],
  );
  await client.query("SELECT set_config('busesuta.programming_write','off',true)");
  return readProgramming(client, routeSheetId, cooperativeId);
}

module.exports = { readProgramming, writeProgramming };
