const GuestAccessError = require('../domain/guest-access-error');

class PgGuestEmailAccessRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async createChallenge({ email, tokenHash, expiresAt }) {
    await this.pool.query(
      `INSERT INTO auth_guest_verifications (email,token_hash,expires_at)
       VALUES ($1,$2,$3)`,
      [email, tokenHash, expiresAt],
    );
  }

  async redeemChallenge({ tokenHash, sessionHash, sessionId, guestBuyerId, now, expiresAt }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT email,expires_at,used_at FROM auth_guest_verifications
         WHERE token_hash=$1 FOR UPDATE`,
        [tokenHash],
      );
      const challenge = rows[0];
      if (!challenge || challenge.used_at || new Date(challenge.expires_at) <= now)
        throw new GuestAccessError();
      await client.query(`UPDATE auth_guest_verifications SET used_at=$2 WHERE token_hash=$1`, [
        tokenHash,
        now,
      ]);
      const buyer = await client.query(
        `INSERT INTO auth_guest_buyers (id,email) VALUES ($1,$2)
         ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id`,
        [guestBuyerId, challenge.email],
      );
      const verifiedBuyerId = buyer.rows[0].id;
      await client.query(
        `INSERT INTO auth_guest_sessions (id,buyer_id,session_hash,expires_at)
         VALUES ($1,$2,$3,$4)`,
        [sessionId, verifiedBuyerId, sessionHash, expiresAt],
      );
      await client.query('COMMIT');
      return Object.freeze({ guestBuyerId: verifiedBuyerId, email: challenge.email });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error instanceof GuestAccessError) return null;
      throw error;
    } finally {
      client.release();
    }
  }

  async findSession(sessionHash) {
    const { rows } = await this.pool.query(
      `SELECT s.buyer_id,b.email,s.expires_at,s.revoked_at
       FROM auth_guest_sessions s JOIN auth_guest_buyers b ON b.id=s.buyer_id
       WHERE s.session_hash=$1`,
      [sessionHash],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      guestBuyerId: row.buyer_id,
      email: row.email,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    };
  }

  async revokeSession(sessionHash, now) {
    await this.pool.query(
      `UPDATE auth_guest_sessions SET revoked_at=$2
       WHERE session_hash=$1 AND revoked_at IS NULL`,
      [sessionHash, now],
    );
  }
}

module.exports = PgGuestEmailAccessRepository;
