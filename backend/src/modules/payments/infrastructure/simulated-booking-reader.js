class SimulatedBookingReader {
  constructor(bookings = []) {
    this.bookings = new Map(bookings.map((booking) => [booking.bookingId, booking]));
  }

  async findForPayment(bookingId) {
    return this.bookings.get(bookingId) || null;
  }
}

module.exports = SimulatedBookingReader;
