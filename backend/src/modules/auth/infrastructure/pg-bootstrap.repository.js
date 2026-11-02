const AuthError = require('../domain/auth-error');
class PgBootstrapRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async bootstrapAdmin({ email, passwordHash }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const { rows } = await client.query("SELECT id FROM users WHERE role='SYSTEM_ADMIN' LIMIT 1");
      if (rows.length) {
        await client.query('COMMIT');
        return { created: false };
      }
      await client.query(
        "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,'SYSTEM_ADMIN',NULL)",
        [email, passwordHash],
      );
      await client.query('COMMIT');
      return { created: true };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') throw new AuthError('REGISTRATION_CONFLICT');
      throw error;
    } finally {
      client.release();
    }
  }
}
module.exports = PgBootstrapRepository;
