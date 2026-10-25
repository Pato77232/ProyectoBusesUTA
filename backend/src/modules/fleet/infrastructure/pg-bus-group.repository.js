const BusGroupRepository = require('../domain/bus-group.repository');
const BusGroupError = require('../domain/bus-group-error');

class PgBusGroupRepository extends BusGroupRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async create(cooperativeId, data) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO bus_groups (cooperative_id, name, category)
         VALUES ($1, $2, $3)
         RETURNING id, name, category, created_at, updated_at`,
        [cooperativeId, data.name, data.category],
      );
      return rows[0];
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'bus_groups_cooperative_name_unique') {
        throw new BusGroupError('BUS_GROUP_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  async listByCooperative(cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT id, name, category, created_at, updated_at
       FROM bus_groups
       WHERE cooperative_id = $1
       ORDER BY name ASC, id ASC`,
      [cooperativeId],
    );
    return rows;
  }

  async findById(id, cooperativeId) {
    const { rows } = await this.pool.query(
      `SELECT id, cooperative_id, name, category, created_at, updated_at
       FROM bus_groups
       WHERE id = $1 AND cooperative_id = $2`,
      [id, cooperativeId],
    );
    return rows[0] ?? null;
  }
}

module.exports = PgBusGroupRepository;
