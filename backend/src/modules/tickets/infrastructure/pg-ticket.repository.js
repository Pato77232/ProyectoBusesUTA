const SELECT_TICKETS = `SELECT id, cooperative_id AS "cooperativeId", booking_id AS "bookingId",
    seat_id AS "seatId", code, issued_at AS "issuedAt"
  FROM tickets WHERE booking_id=$1 AND cooperative_id=$2 ORDER BY seat_id`;

class PgTicketRepository {
  constructor({ pool }) {
    if (typeof pool?.query !== 'function')
      throw new TypeError('Se requiere una conexión de Boletos.');
    this.pool = pool;
  }

  /**
   * Inserta los boletos que falten (uno por reserva y asiento) y devuelve todos los guardados.
   * ON CONFLICT conserva el boleto existente, así que emisiones repetidas o simultáneas no
   * cambian códigos ya entregados.
   */
  async issueMissing({ cooperativeId, bookingId, issuedAt, tickets }) {
    await this.pool.query(
      `INSERT INTO tickets (id, cooperative_id, booking_id, seat_id, code, issued_at)
       SELECT t.id, $1, $2, t.seat_id, t.code, $3
       FROM unnest($4::uuid[], $5::text[], $6::text[]) AS t(id, seat_id, code)
       ON CONFLICT (booking_id, seat_id) DO NOTHING`,
      [
        cooperativeId,
        bookingId,
        issuedAt,
        tickets.map(({ id }) => id),
        tickets.map(({ seatId }) => seatId),
        tickets.map(({ code }) => code),
      ],
    );
    const { rows } = await this.pool.query(SELECT_TICKETS, [bookingId, cooperativeId]);
    return rows;
  }
}

module.exports = PgTicketRepository;
