const lockWrites = require('./programming-write-lock');

function createFrequencyCommitmentQueries({ occupancyQueries }) {
  return Object.freeze({
    forTransaction(executor) {
      return Object.freeze({
        lock: () => lockWrites(executor),
        async find({ frequencyId, cooperativeId }) {
          const { rows: clock } = await executor.query('SELECT clock_timestamp() AS checked_at');
          const checkedAt = clock[0]?.checked_at;
          if (!(checkedAt instanceof Date) || !Number.isFinite(checkedAt.getTime())) {
            return { verifiable: false };
          }
          const { rows } = await executor.query(
            `SELECT EXISTS (
              SELECT 1 FROM route_sheet_assignments a
              JOIN route_sheets s ON s.id=a.route_sheet_id AND s.cooperative_id=a.cooperative_id
              LEFT JOIN route_sheet_programmings p ON p.route_sheet_id=s.id AND p.cooperative_id=s.cooperative_id
              WHERE a.cooperative_id=$1 AND a.frequency_id=$2 AND s.status='PUBLISHED'
                AND p.route_sheet_id IS NULL
            ) AS unverified,
            EXISTS (
              SELECT 1 FROM route_sheet_assignments a
              JOIN route_sheets s ON s.id=a.route_sheet_id AND s.cooperative_id=a.cooperative_id
              JOIN route_sheet_programmings p ON p.route_sheet_id=s.id AND p.cooperative_id=s.cooperative_id
              WHERE a.cooperative_id=$1 AND a.frequency_id=$2 AND s.status='PUBLISHED'
                AND p.end_exclusive > $3
            ) AS unfinished`,
            [cooperativeId, frequencyId, checkedAt],
          );
          const { rows: trips } = await executor.query(
            `SELECT t.id FROM route_sheet_trips t
             JOIN route_sheets s ON s.id=t.route_sheet_id AND s.cooperative_id=t.cooperative_id
             WHERE t.cooperative_id=$1 AND t.frequency_id=$2 AND s.status='PUBLISHED'
               AND t.arrival_at > $3`,
            [cooperativeId, frequencyId, checkedAt],
          );
          const occupations = occupancyQueries?.forTransaction?.(executor);
          if (
            !occupations?.hasActiveOccupations ||
            typeof rows[0]?.unverified !== 'boolean' ||
            typeof rows[0]?.unfinished !== 'boolean'
          )
            return { verifiable: false };
          const hasPassengers = await occupations.hasActiveOccupations({
            cooperativeId,
            tripIds: trips.map((trip) => trip.id),
          });
          return {
            verifiable: !rows[0].unverified,
            hasUnfinishedCycles: rows[0].unfinished,
            hasFutureServices: trips.length > 0,
            hasPassengers,
          };
        },
      });
    },
  });
}

module.exports = createFrequencyCommitmentQueries;
