const AuthError = require('../domain/auth-error');

class PgPasswordResetRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async request({ email, ip, ipMax, emailMax, windowMinutes, cooldownSeconds }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Los bloqueos serializan contadores entre procesos, incluso para cuentas inexistentes.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`reset-ip:${ip}`]);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`reset-email:${email}`]);
      const ipCount = await client.query(
        `SELECT count(*)::int AS count FROM auth_password_reset_attempts
         WHERE ip=$1 AND requested_at > CURRENT_TIMESTAMP - $2::int * INTERVAL '1 minute'`,
        [ip, windowMinutes],
      );
      if (ipCount.rows[0].count >= ipMax) throw new AuthError('TOO_MANY_ATTEMPTS');
      const emailCount = await client.query(
        `SELECT CURRENT_TIMESTAMP AS now,
                count(*) FILTER (WHERE accepted)::int AS count,
                max(requested_at) FILTER (WHERE accepted) AS last_accepted_at
         FROM auth_password_reset_attempts
         WHERE email=$1 AND requested_at > CURRENT_TIMESTAMP - $2::int * INTERVAL '1 minute'`,
        [email, windowMinutes],
      );
      const user = await client.query('SELECT id FROM users WHERE email=$1', [email]);
      const { now, count, last_accepted_at: lastAcceptedAt } = emailCount.rows[0];
      const eligible =
        count < emailMax &&
        (!lastAcceptedAt || now.getTime() - lastAcceptedAt.getTime() >= cooldownSeconds * 1000);
      await client.query(
        'INSERT INTO auth_password_reset_attempts(email,ip,accepted) VALUES($1,$2,$3)',
        [email, ip, eligible],
      );
      if (eligible && user.rows[0]) {
        await client.query(
          `UPDATE auth_email_actions SET state='SUPERSEDED'
           WHERE user_id=$1 AND purpose='PASSWORD_RESET'
             AND state IN ('PENDING','SENDING','ACCEPTED') AND used_at IS NULL`,
          [user.rows[0].id],
        );
        await client.query(
          `INSERT INTO auth_email_actions(user_id,purpose,state)
           VALUES($1,'PASSWORD_RESET','PENDING')`,
          [user.rows[0].id],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = PgPasswordResetRepository;
