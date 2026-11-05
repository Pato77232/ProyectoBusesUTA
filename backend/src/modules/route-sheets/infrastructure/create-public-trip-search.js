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

    /**
     * SEARCH-02: próximas salidas con su recorrido completo. Sin fecha, desde ahora hasta
     * `days` días; con fecha, ese día local de Ecuador. Cada candidato se revalida con la
     * consulta comercial, así que solo quedan viajes vendibles.
     */
    async findUpcoming({ date = null, cooperativeId = null, days, limit }) {
      const { rows } = await pool.query(
        `SELECT t.id, jsonb_array_length(t.route_points)-1 AS last_position
      FROM route_sheet_trips t JOIN route_sheets s ON s.id=t.route_sheet_id AND s.cooperative_id=t.cooperative_id
      WHERE s.status='PUBLISHED' AND t.departure_at>clock_timestamp()
        AND t.departure_at>=COALESCE(($1::date)::timestamp AT TIME ZONE 'America/Guayaquil',clock_timestamp())
        AND t.departure_at<COALESCE((($1::date)+1)::timestamp AT TIME ZONE 'America/Guayaquil',
          clock_timestamp()+make_interval(days=>$2::int))
        AND ($3::uuid IS NULL OR t.cooperative_id=$3::uuid)
      ORDER BY t.departure_at,t.id LIMIT $4`,
        [date, days, cooperativeId, limit + 1],
      );
      const trips = [];
      for (const row of rows.slice(0, limit)) {
        const trip = await tripQueries.findBookableForSegment({
          tripId: row.id,
          fromPosition: 0,
          toPosition: row.last_position,
        });
        if (trip === null) continue;
        const last = trip.routePoints.length - 1;
        trips.push({
          tripId: trip.tripId,
          cooperativeId: trip.cooperativeId,
          fromPosition: trip.fromPosition,
          toPosition: trip.toPosition,
          boardingAt: trip.boardingAt,
          arrivalAt: trip.routePoints[trip.toPosition].arrivalAt,
          origin: trip.routePoints[trip.fromPosition].locationKey,
          destination: trip.routePoints[trip.toPosition].locationKey,
          stopCount: Math.max(0, last - 1),
          currency: trip.currency,
          amountCents: trip.amountCents,
        });
      }
      return { trips, truncated: rows.length > limit };
    },
  });
