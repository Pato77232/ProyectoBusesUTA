// Solo los datos específicos acreditados; el orden de pasajeros no cambia su identidad.
module.exports = ({ ownerId, tripId, fromPosition, toPosition, passengers }) =>
  JSON.stringify({
    ownerId,
    tripId,
    fromPosition,
    toPosition,
    passengers: passengers
      .map(({ seatId, identificationNumber, fullName, birthDate }) => ({
        seatId,
        identificationNumber,
        fullName,
        birthDate,
      }))
      .sort((a, b) => a.seatId.localeCompare(b.seatId)),
  });
