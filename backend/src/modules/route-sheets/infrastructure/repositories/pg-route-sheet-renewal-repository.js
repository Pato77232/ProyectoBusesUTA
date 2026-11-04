const lockWrites = require('../programming-write-lock');
const { readProgramming, writeProgramming } = require('./programming-records');
const { findCommitments } = require('./pg-route-sheet-programming-repository');
const { readCommercialManifest, listCommercialSeries } = require('./commercial-trip-records');
const { sourceSnapshot, replayRecord } = require('./renewal-records');
const {
  RenewalConflictError,
  RenewalNotFoundError,
  RenewalUncertainError,
} = require('../../domain/errors/route-renewal-errors');

async function save(client, context, plan, candidate) {
  const draft = plan.draft;
  await client.query(
    `INSERT INTO route_sheets(id,cooperative_id,bus_group_id,route_date,created_by,
    tariff_draft,tariff_revision,tariff_updated_by,tariff_updated_at)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,1,$5,$7)`,
    [
      draft.routeSheetId,
      context.cooperativeId,
      draft.busGroupId,
      draft.programming.cycleStartDate,
      context.modifiedBy,
      JSON.stringify(draft.tariff),
      plan.createdAt,
    ],
  );
  await writeProgramming(client, { ...context, routeSheetId: draft.routeSheetId }, candidate, 1);
  const renewal = {
    routeSheetId: draft.routeSheetId,
    sourceRouteSheetId: plan.sourceRouteSheetId,
    seriesId: plan.seriesId,
    status: 'DRAFT',
    startAt: plan.startAt,
    endExclusive: plan.endExclusive,
    cycleLengthDays: draft.programming.cycleLengthDays,
    programmingRevision: 1,
    tariffRevision: 1,
    createdBy: plan.createdBy,
    createdAt: plan.createdAt,
  };
  await client.query(
    `INSERT INTO route_sheet_renewals(cooperative_id,request_key,source_route_sheet_id,
    target_route_sheet_id,series_id,bus_group_id,source_programming_revision,source_tariff_revision,
    start_at,end_exclusive,created_by,created_at,response) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
    [
      context.cooperativeId,
      plan.request.requestKey,
      plan.sourceRouteSheetId,
      draft.routeSheetId,
      plan.seriesId,
      draft.busGroupId,
      plan.request.expectedProgrammingRevision,
      plan.request.expectedTariffRevision,
      plan.startAt,
      plan.endExclusive,
      plan.createdBy,
      plan.createdAt,
      JSON.stringify(renewal),
    ],
  );
  await client.query(
    `INSERT INTO route_sheet_modification_logs(route_sheet_id,cooperative_id,bus_group_id,
    modified_by,reason,action,affected_entity,entity_id,new_value)
    VALUES($1,$2,$3,$4,'Renovación explícita de ciclo','RENEWAL_PREPARE','ROUTE_SHEET',$1,$5::jsonb)`,
    [
      draft.routeSheetId,
      context.cooperativeId,
      draft.busGroupId,
      context.modifiedBy,
      JSON.stringify(renewal),
    ],
  );
  return { renewal, replayed: false };
}

class PgRouteSheetRenewalRepository {
  constructor(pool, { frequencySessionFactory } = {}) {
    this.pool = pool;
    this.frequencySessionFactory = frequencySessionFactory;
  }

  async withLockedRenewal(context, work) {
    const client = await this.pool.connect();
    let committing = false;
    try {
      await client.query('BEGIN');
      await lockWrites(client);
      const result = await work({
        frequencyQueryPort: this.frequencySessionFactory?.(client),
        findReplay: async (requestKey) =>
          replayRecord(
            (
              await client.query(
                'SELECT * FROM route_sheet_renewals WHERE cooperative_id=$1 AND request_key=$2',
                [context.cooperativeId, requestKey],
              )
            ).rows[0],
          ),
        readSnapshot: async () => {
          const { rows } = await client.query(
            'SELECT * FROM route_sheets WHERE id=$1 AND cooperative_id=$2 FOR UPDATE',
            [context.sourceRouteSheetId, context.cooperativeId],
          );
          const sheet = rows[0];
          if (!sheet) throw new RenewalNotFoundError();
          if (sheet.status !== 'PUBLISHED')
            throw new RenewalConflictError(
              'ROUTE_RENEWAL_NOT_PUBLISHED',
              'El origen debe estar publicado.',
            );
          const record = await readProgramming(client, sheet.id, context.cooperativeId);
          const manifest = await readCommercialManifest(client, {
            routeSheetId: sheet.id,
            cooperativeId: context.cooperativeId,
          });
          const source = sourceSnapshot(sheet, record, manifest);
          const series = (
            await listCommercialSeries(client, {
              cooperativeId: context.cooperativeId,
              busGroupId: sheet.bus_group_id,
            })
          ).find((v) => v.id === source.seriesId);
          const commitments = await findCommitments(
            client,
            { routeSheetId: sheet.id, cooperativeId: context.cooperativeId },
            record.programming,
          );
          commitments.programs.push(record.programming);
          return { source, series, commitments };
        },
        findTarget: async (seriesId, startAt) =>
          (
            await client.query(
              'SELECT target_route_sheet_id FROM route_sheet_renewals WHERE cooperative_id=$1 AND series_id=$2 AND start_at=$3',
              [context.cooperativeId, seriesId, startAt],
            )
          ).rows[0] ?? null,
        save: (plan, candidate) => save(client, context, plan, candidate),
      });
      committing = true;
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* Conservar causa y permitir recuperación por clave. */
      }
      if (committing) throw new RenewalUncertainError();
      if (
        error.code === '23505' &&
        [
          'route_sheet_renewals_pkey',
          'route_sheet_renewals_cooperative_id_series_id_start_at_key',
          'route_sheets_cooperative_bus_group_date_unique',
        ].includes(error.constraint)
      )
        throw new RenewalConflictError(
          'ROUTE_RENEWAL_TARGET_CONFLICT',
          'Ya existe una preparación para esa solicitud o período.',
        );
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = PgRouteSheetRenewalRepository;
