function soldRow() {
  const passengers = [
    {
      seatId: 'seat-1',
      fullName: 'Pasajera QA Uno',
      identificationNumber: '1710034065',
      birthDate: '1990-01-01',
      quote: { totalPriceCents: 600 },
      accreditation: 'privado',
    },
    {
      seatId: 'seat-2',
      fullName: 'Pasajero QA Dos',
      identificationNumber: '1710034065',
      birthDate: '1990-01-01',
      quote: { totalPriceCents: 400 },
    },
  ];
  return {
    bookingId: 'venta-opaca/qa',
    cooperativeId: 'coop-ticket',
    tripId: 'trip-ticket',
    status: 'SOLD',
    fromPosition: '0',
    toPosition: '1',
    totalPriceCents: '1000',
    soldAt: new Date('2026-11-04T14:02:00.000Z'),
    ownerId: 'propietario-privado',
    summary: {
      schemaVersion: 2,
      tripId: 'trip-ticket',
      cooperativeId: 'coop-ticket',
      fromPosition: 0,
      toPosition: 1,
      currency: 'USD',
      passengers,
      totals: { totalPriceCents: 1000 },
      privateField: 'no-exportar',
    },
    allocations: passengers.map(({ seatId }) => ({
      bookingId: 'venta-opaca/qa',
      cooperativeId: 'coop-ticket',
      tripId: 'trip-ticket',
      seatId,
      fromPosition: 0,
      toPosition: 1,
      status: 'SOLD',
    })),
  };
}
module.exports = soldRow;
