const AuthError = require('../domain/auth-error');
class PgAuthRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async findByEmail(email) {
    const { rows } = await this.pool.query(
      'SELECT id,email,password_hash,role,cooperative_id FROM users WHERE email=$1',
      [email],
    );
    return rows[0];
  }
  async createSession({ id, userId, expiresAt }) {
    await this.pool.query('INSERT INTO auth_sessions (id,user_id,expires_at) VALUES ($1,$2,$3)', [
      id,
      userId,
      expiresAt,
    ]);
  }
  async findSession(sid, userId) {
    const { rows } = await this.pool.query(
      `SELECT u.id,u.email,u.role,u.cooperative_id,s.expires_at,s.revoked_at
      FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2`,
      [sid, userId],
    );
    return rows[0];
  }
  async revokeSession(sid, userId) {
    await this.pool.query(
      "UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP,revoke_reason='logout' WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL",
      [sid, userId],
    );
  }
  async createCooperativeAdmin({ cooperativeId, email, passwordHash }) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO users(email,password_hash,role,cooperative_id)
         VALUES($1,$2,'COOPERATIVE_ADMIN',$3) RETURNING id,email,role,cooperative_id`,
        [email, passwordHash, cooperativeId],
      );
      return rows[0];
    } catch (error) {
      if (error.code === '23505') throw new AuthError('REGISTRATION_CONFLICT');
      if (error.code === '23503' && error.constraint === 'users_cooperative_id_fk')
        throw new AuthError('COOPERATIVE_NOT_FOUND');
      throw error;
    }
  }
  async createCustomer({ email, passwordHash }) {
    try {
      await this.pool.query(
        "INSERT INTO users (email,password_hash,role,cooperative_id) VALUES ($1,$2,'CUSTOMER',NULL)",
        [email, passwordHash],
      );
    } catch (error) {
      if (error.code === '23505') throw new AuthError('REGISTRATION_CONFLICT');
      throw error;
    }
  }
}
module.exports = PgAuthRepository;
