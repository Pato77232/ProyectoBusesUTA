const soldRow = require('./sold-booking-ticket');

const OWNER_ID = 'propietario-privado';

function routePoints() {
  return [
    { position: 0, locationKey: 'Ambato', departureAt: '2026-11-10T08:00:00-05:00' },
    {
      position: 1,
      locationKey: 'Latacunga',
      arrivalAt: '2026-11-10T08:50:00-05:00',
      departureAt: '2026-11-10T08:55:00-05:00',
    },
    { position: 2, locationKey: 'Quito', arrivalAt: '2026-11-10T10:30:00-05:00' },
  ];
}

function soldRowWithTrip() {
  const row = soldRow();
  row.ownerId = OWNER_ID;
  row.summary.departureDate = '2026-11-10';
  row.summary.commercial = {
    boardingAt: '2026-11-10T08:00:00-05:00',
    routePoints: routePoints(),
  };
  return row;
}

module.exports = { OWNER_ID, soldRowWithTrip };
