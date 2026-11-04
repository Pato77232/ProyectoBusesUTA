const MAX_RESULTS = 100;
module.exports = ({ pool, tripQueries }) =>
  Object.freeze({
    async find({ origin, destination, date }) {
      const { rows } = await pool.query(
        `SELECT t.id, a.position::int-1 AS from_position,b.position::int-1 AS to_position
      FROM route_sheet_trips t JOIN route_sheets s ON s.id=t.route_sheet_id AND s.cooperative_id=t.cooperative_id
      CROSS JOIN LATERAL jsonb_array_elements(t.route_points) WITH ORDINALITY a(point,position)
      CROSS JOIN LATERAL jsonb_array_elements(t.route_points) WITH ORDINALITY b(point,position)
      WHERE s.status='PUBLISHED' AND a.position<b.position
        AND lower(btrim(a.point->>'locationKey'))=lower(btrim($1))
        AND lower(btrim(b.point->>'locationKey'))=lower(btrim($2))
        AND ((a.point->>'departureAt')::timestamptz AT TIME ZONE 'America/Guayaquil')::date=$3::date
        AND (a.point->>'departureAt')::timestamptz>clock_timestamp()
      ORDER BY (a.point->>'departureAt')::timestamptz,t.id,a.position,b.position LIMIT $4`,
        [origin, destination, date, MAX_RESULTS + 1],
      );
      const trips = [];
      for (const row of rows.slice(0, MAX_RESULTS)) {
        const trip = await tripQueries.findBookableForSegment({
          tripId: row.id,
          fromPosition: row.from_position,
          toPosition: row.to_position,
        });
        if (trip === null) continue;
        trips.push({
          tripId: trip.tripId,
          cooperativeId: trip.cooperativeId,
          fromPosition: trip.fromPosition,
          toPosition: trip.toPosition,
          boardingAt: trip.boardingAt,
          arrivalAt: trip.routePoints[trip.toPosition].arrivalAt,
          origin: trip.routePoints[trip.fromPosition].locationKey,
          destination: trip.routePoints[trip.toPosition].locationKey,
          currency: trip.currency,
          amountCents: trip.amountCents,
        });
      }
      return { trips, truncated: rows.length > MAX_RESULTS };
    },
  });
