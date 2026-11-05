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

  async claimNext({ claimMs }) {
    const { rows } = await this.pool.query(
      `WITH candidate AS (
         SELECT id FROM auth_email_actions
         WHERE (state='PENDING' AND available_at<=CURRENT_TIMESTAMP)
            OR (state='SENDING' AND claimed_at<=CURRENT_TIMESTAMP-$1::int*INTERVAL '1 millisecond')
         ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE auth_email_actions AS action
       SET state='SENDING',claimed_at=CURRENT_TIMESTAMP,attempts=action.attempts+1,
           token_hash=NULL,token_expires_at=NULL
       FROM candidate WHERE action.id=candidate.id
       RETURNING action.id,action.user_id,action.attempts`,
      [claimMs],
    );
    return rows[0];
  }

  async recipient(userId) {
    const { rows } = await this.pool.query('SELECT email FROM users WHERE id=$1', [userId]);
    return rows[0]?.email;
  }

  async storeToken({ id, attempts, tokenHash, tokenMinutes }) {
    const { rowCount } = await this.pool.query(
      `UPDATE auth_email_actions
       SET token_hash=$3,token_expires_at=CURRENT_TIMESTAMP+$4::int*INTERVAL '1 minute'
       WHERE id=$1 AND attempts=$2 AND state='SENDING'`,
      [id, attempts, tokenHash, tokenMinutes],
    );
    return rowCount === 1;
  }

  async accept({ id, attempts }) {
    await this.pool.query(
      `UPDATE auth_email_actions SET state='ACCEPTED',claimed_at=NULL
       WHERE id=$1 AND attempts=$2 AND state='SENDING'`,
      [id, attempts],
    );
  }

  async fail({ id, attempts, retryMinutes }) {
    await this.pool.query(
      `UPDATE auth_email_actions
       SET state=CASE WHEN $3::int IS NULL THEN 'FAILED' ELSE 'PENDING' END,
           available_at=CASE WHEN $3::int IS NULL THEN available_at
                             ELSE CURRENT_TIMESTAMP+$3::int*INTERVAL '1 minute' END,
           claimed_at=NULL,
           token_hash=CASE WHEN $3::int IS NULL THEN NULL ELSE token_hash END,
           token_expires_at=CASE WHEN $3::int IS NULL THEN NULL ELSE token_expires_at END
       WHERE id=$1 AND attempts=$2 AND state='SENDING'`,
      [id, attempts, retryMinutes],
    );
  }

  async pruneAttempts(retentionDays) {
    await this.pool.query(
      `WITH expired AS (
         SELECT id FROM auth_password_reset_attempts
         WHERE requested_at<CURRENT_TIMESTAMP-$1::int*INTERVAL '1 day'
         ORDER BY requested_at,id FOR UPDATE SKIP LOCKED LIMIT 1000
       )
       DELETE FROM auth_password_reset_attempts AS attempt
       USING expired WHERE attempt.id=expired.id`,
      [retentionDays],
    );
  }
}

module.exports = PgPasswordResetRepository;
