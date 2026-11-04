const CooperativeRepository = require('../domain/cooperative.repository');
const CooperativeError = require('../domain/cooperative-error');
class PgCooperativeRepository extends CooperativeRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }
  async create(data) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO cooperatives(name,ruc,email,phone,address)
        VALUES($1,$2,$3,$4,$5) RETURNING id,name,ruc,email,phone,address,created_at,updated_at`,
        [data.name, data.ruc, data.email, data.phone, data.address],
      );
      return rows[0];
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'cooperatives_ruc_unique')
        throw new CooperativeError('COOPERATIVE_ALREADY_EXISTS');
      throw error;
    }
  }
}
module.exports = PgCooperativeRepository;
