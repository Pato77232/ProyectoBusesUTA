const COLUMNS = `id, kind, booking_id AS "bookingId", cooperative_id AS "cooperativeId", payload,
  attempts`;

/**
 * Reclamo y cierre de avisos. Cada reclamo suma un intento; los cierres exigen el mismo
 * `attempts` del reclamo, así un trabajador lento no pisa a otro que reclamó después.
 */
class PgNotificationDeliveryRepository {
  constructor({ pool }) {
    if (typeof pool?.query !== 'function')
      throw new TypeError('Se requiere una conexión de Avisos.');
    this.pool = pool;
  }

  async claimNext({ now, claimMs }) {
    const { rows } = await this.pool.query(
      `UPDATE email_notifications AS notice
         SET state='SENDING', claimed_at=$1, attempts=notice.attempts+1
       WHERE notice.id = (
         SELECT id FROM email_notifications
          WHERE (state='PENDING' AND next_attempt_at <= $1)
             OR (state='SENDING' AND claimed_at <= $1 - $2::int * INTERVAL '1 millisecond')
          ORDER BY next_attempt_at, id
          FOR UPDATE SKIP LOCKED LIMIT 1)
       RETURNING ${COLUMNS}`,
      [now, claimMs],
    );
    return rows[0] ?? null;
  }

  async finish({ id, attempts, state, code = null, now }) {
    const { rowCount } = await this.pool.query(
      `UPDATE email_notifications
          SET state=$3, last_error_code=$4, finished_at=$5, claimed_at=NULL
        WHERE id=$1 AND attempts=$2 AND state='SENDING'`,
      [id, attempts, state, code, now],
    );
    return rowCount === 1;
  }

  async retry({ id, attempts, code, nextAttemptAt }) {
    const { rowCount } = await this.pool.query(
      `UPDATE email_notifications
          SET state='PENDING', last_error_code=$3, next_attempt_at=$4, claimed_at=NULL
        WHERE id=$1 AND attempts=$2 AND state='SENDING'`,
      [id, attempts, code, nextAttemptAt],
    );
    return rowCount === 1;
  }
}

module.exports = PgNotificationDeliveryRepository;
