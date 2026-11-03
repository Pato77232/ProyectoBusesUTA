// Datos sintéticos para las pruebas; no representan un viaje ni una identidad reales.
function summaryInput() {
  return {
    tripId: 'viaje-prueba',
    fromPosition: 1,
    toPosition: 3,
    seatIds: ['01', '02'],
    passengers: [
      {
        seatId: '02',
        identificationNumber: '0100000009',
        fullName: 'Pasajera Menor',
        birthDate: '2010-01-01',
      },
      {
        seatId: '01',
        identificationNumber: '0100000009',
        fullName: 'Pasajera Adulta',
        birthDate: '1990-01-01',
      },
    ],
  };
}

function summaryContext() {
  return {
    onDate: '2026-10-27',
    trip: {
      tripId: 'viaje-prueba',
      cooperativeId: 'cooperativa-prueba',
      routePointCount: 5,
      seatIds: ['02', '03', '01'],
      departureDate: '2026-10-28',
      segmentPricesCents: [99, 200, 301, 99],
    },
    passengerBenefits: [
      { seatId: '02', disabilityVerified: false },
      { seatId: '01', disabilityVerified: false },
    ],
  };
}

module.exports = { summaryInput, summaryContext };
