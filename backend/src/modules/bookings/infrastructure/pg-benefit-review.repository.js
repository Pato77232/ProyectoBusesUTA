const { createHash } = require('node:crypto');
const Port = require('../domain/benefit-review.repository');
const hash = (context) => createHash('sha256').update(context).digest('hex');
class PgBenefitReviewRepository extends Port {
  constructor(pool) {
    super();
    this.pool = pool;
  }
  async append({ cooperativeId, actorId, context, decisions, reviewedAt, expiresAt }) {
    await this.pool.query(
      `INSERT INTO booking_benefit_reviews
      (cooperative_id,reviewed_by,context_hash,decisions,reviewed_at,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [cooperativeId, actorId, hash(context), JSON.stringify(decisions), reviewedAt, expiresAt],
    );
  }
  async findLatest({ cooperativeId, context }) {
    const { rows } = await this.pool.query(
      `SELECT decisions, expires_at AS "expiresAt"
      FROM booking_benefit_reviews WHERE cooperative_id=$1 AND context_hash=$2
      ORDER BY id DESC LIMIT 1`,
      [cooperativeId, hash(context)],
    );
    return rows[0] ?? null;
  }
}
module.exports = PgBenefitReviewRepository;
