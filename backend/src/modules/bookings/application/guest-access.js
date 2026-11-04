const { randomBytes, createHash, randomUUID } = require('node:crypto');

class GuestAccessError extends Error {
  constructor() {
    super('El enlace de invitado no es válido.');
    this.code = 'GUEST_ACCESS_INVALID';
    this.httpStatus = 404;
  }
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createGuestAccess({
  pool,
  clock = () => new Date(),
  tokenBytes = 32,
  ttlMs = 15 * 60 * 1000,
  newId = randomUUID,
}) {
  return {
    async issue({ bookingId, ownerId, expiresAt, send }) {
      const token = randomBytes(tokenBytes).toString('base64url');
      const expiry = expiresAt instanceof Date ? expiresAt : new Date(clock().getTime() + ttlMs);
      const { rows } = await pool.query(
        `INSERT INTO booking_guest_access_tokens (id,booking_id,token_hash,expires_at)
         SELECT $1,b.id,$3,$4 FROM bookings b WHERE b.id=$2 AND b.owner_id=$5
         RETURNING id,expires_at`,
        [newId(), bookingId, hashToken(token), expiry, ownerId],
      );
      if (!rows.length) throw new GuestAccessError();
      if (typeof send === 'function')
        await send({ bookingId, token, expiresAt: rows[0].expires_at });
      return { expiresAt: rows[0].expires_at, token };
    },
    async consume(token) {
      if (typeof token !== 'string' || token.length < 40) throw new GuestAccessError();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `SELECT t.id,t.expires_at,t.used_at,b.id AS booking_id,b.status,b.trip_id,b.from_position,b.to_position,
             b.total_price_cents,b.summary->>'currency' AS currency,b.created_at
           FROM booking_guest_access_tokens t JOIN bookings b ON b.id=t.booking_id
           WHERE t.token_hash=$1 FOR UPDATE`,
          [hashToken(token)],
        );
        const row = rows[0];
        if (!row || row.used_at || new Date(row.expires_at) <= clock())
          throw new GuestAccessError();
        await client.query('UPDATE booking_guest_access_tokens SET used_at=$2 WHERE id=$1', [
          row.id,
          clock(),
        ]);
        await client.query('COMMIT');
        return {
          bookingId: row.booking_id,
          status: row.status,
          tripId: row.trip_id,
          fromPosition: row.from_position,
          toPosition: row.to_position,
          totalPriceCents: row.total_price_cents,
          currency: row.currency,
          createdAt: row.created_at,
        };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error instanceof GuestAccessError) throw error;
        throw new GuestAccessError();
      } finally {
        client.release();
      }
    },
  };
}

module.exports = { createGuestAccess, GuestAccessError, hashToken };
