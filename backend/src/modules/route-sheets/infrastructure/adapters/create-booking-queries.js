const { BookingQueriesUnavailableError } = require('./booking-query-adapter');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createBookingQueries({ pool, occupancyQueries }) {
  async function hasPassengers(where, values) {
    if (values.some((id) => typeof id !== 'string' || !UUID.test(id))) {
      throw new TypeError('Las consultas de pasajeros requieren identificadores UUID.');
    }
    if (typeof occupancyQueries?.hasActiveOccupations !== 'function') {
      throw new BookingQueriesUnavailableError();
    }
    const { rows } = await pool.query(`SELECT id FROM route_sheet_trips WHERE ${where}`, values);
    const result = await occupancyQueries.hasActiveOccupations({
      tripIds: rows.map((row) => row.id),
      cooperativeId: values[0],
    });
    if (typeof result !== 'boolean') {
      throw new TypeError('La consulta de ocupaciones debe devolver un booleano.');
    }
    return result;
  }

  return Object.freeze({
    hasPassengersForAssignment(assignmentId, cooperativeId) {
      return hasPassengers('cooperative_id=$1 AND assignment_id=$2', [cooperativeId, assignmentId]);
    },
    hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId) {
      return hasPassengers('cooperative_id=$1 AND route_sheet_id=$2 AND bus_id=$3', [
        cooperativeId,
        routeSheetId,
        busId,
      ]);
    },
  });
}

module.exports = createBookingQueries;
