const { createHash } = require('node:crypto');
const Failure = require('../domain/benefit-request-error');
const COLUMNS = `id, owner_id AS "ownerId", cooperative_id AS "cooperativeId", trip_id AS "tripId",
  from_position AS "fromPosition", to_position AS "toPosition", fingerprint,
  status,revision,journey,created_at AS "createdAt",expires_at AS "expiresAt",reviewed_at AS "reviewedAt",
  jsonb_array_length(purchase->'passengers') AS "passengerCount"`;
const REVIEW_COLUMNS = `reviewed_by AS "reviewedBy",review_fingerprint AS "reviewFingerprint",
  review_expected_revision AS "reviewExpectedRevision",review_decisions AS "reviewDecisions",
  benefit_review_id AS "benefitReviewId"`;
class PgBenefitRequestRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async withLockedRequest({ id, cooperativeId }, operation) {
    const client = await this.pool.connect();
    let committing = false;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT ${COLUMNS},purchase,${REVIEW_COLUMNS}
        FROM booking_benefit_requests WHERE id=$1 AND cooperative_id=$2 FOR UPDATE`,
        [id, cooperativeId],
      );
      const row = rows[0] ?? null;
      const result = await operation(row, {
        complete: async ({
          actorId,
          expectedRevision,
          intent,
          decisions,
          proofDecisions,
          context,
          reviewedAt,
        }) => {
          if (!row || row.status !== 'PENDING' || row.revision !== expectedRevision)
            throw new Failure('BOOKING_BENEFIT_REVIEW_CONFLICT');
          const inserted = await client.query(
            `INSERT INTO booking_benefit_reviews
            (cooperative_id,reviewed_by,context_hash,decisions,reviewed_at,expires_at)
            VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
            [
              cooperativeId,
              actorId,
              createHash('sha256').update(context).digest('hex'),
              JSON.stringify(proofDecisions),
              reviewedAt,
              row.expiresAt,
            ],
          );
          const updated = await client.query(
            `UPDATE booking_benefit_requests SET status='REVIEWED',revision=2,
            reviewed_at=$3,reviewed_by=$4,review_fingerprint=$5,review_expected_revision=$6,
            review_decisions=$7,benefit_review_id=$8
            WHERE id=$1 AND cooperative_id=$2 AND status='PENDING' AND revision=$6
              AND expires_at>clock_timestamp()
            RETURNING ${COLUMNS},purchase,${REVIEW_COLUMNS}`,
            [
              id,
              cooperativeId,
              reviewedAt,
              actorId,
              intent,
              expectedRevision,
              JSON.stringify(decisions),
              inserted.rows[0].id,
            ],
          );
          if (!updated.rows.length) throw new Failure('BOOKING_TRIP_UNAVAILABLE');
          return updated.rows[0];
        },
      });
      committing = true;
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (committing) throw new Failure('BOOKING_BENEFIT_REVIEW_UNCERTAIN');
      throw error;
    } finally {
      client.release();
    }
  }
  async findByKey({ ownerId, requestKey }) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS},purchase,${REVIEW_COLUMNS} FROM booking_benefit_requests
      WHERE owner_id=$1 AND request_key=$2`,
      [ownerId, requestKey],
    );
    return rows[0] ?? null;
  }
  async save(input) {
    const { rows } = await this.pool.query(
      `INSERT INTO booking_benefit_requests
      (id,owner_id,cooperative_id,trip_id,request_key,fingerprint,from_position,to_position,purchase,journey,created_at,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT(owner_id,request_key) DO NOTHING RETURNING ${COLUMNS},purchase`,
      [
        input.id,
        input.ownerId,
        input.cooperativeId,
        input.purchase.tripId,
        input.requestKey,
        input.fingerprint,
        input.purchase.fromPosition,
        input.purchase.toPosition,
        JSON.stringify(input.purchase),
        JSON.stringify(input.journey),
        input.createdAt,
        input.expiresAt,
      ],
    );
    return { created: rows.length > 0, row: rows[0] ?? (await this.findByKey(input)) };
  }
  async get({ id, identity }) {
    const field = identity.role === 'CUSTOMER' ? 'owner_id' : 'cooperative_id';
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS},purchase,${REVIEW_COLUMNS} FROM booking_benefit_requests
      WHERE id=$1 AND ${field}=$2`,
      [id, identity.role === 'CUSTOMER' ? identity.userId : identity.cooperativeId],
    );
    return rows[0] ?? null;
  }
  async list({ cooperativeId, cursor, limit }) {
    const values = [cooperativeId];
    let after = '';
    if (cursor) {
      const { rows } = await this.pool.query(
        `SELECT created_at,id FROM booking_benefit_requests
        WHERE id=$1 AND cooperative_id=$2`,
        [cursor, cooperativeId],
      );
      if (!rows.length) throw new Failure('BOOKING_BENEFIT_REQUEST_INVALID');
      values.push(rows[0].created_at, rows[0].id);
      after = ' AND (created_at,id)<($2,$3)';
    }
    values.push(limit + 1);
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS} FROM booking_benefit_requests
      WHERE cooperative_id=$1${after} ORDER BY created_at DESC,id DESC LIMIT $${values.length}`,
      values,
    );
    return {
      rows: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }
}
module.exports = PgBenefitRequestRepository;
