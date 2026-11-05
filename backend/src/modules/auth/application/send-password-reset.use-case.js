const { createHash, randomBytes, randomUUID } = require('node:crypto');

function createSendPasswordReset({ repository, mailer, config }) {
  async function processNext() {
    const action = await repository.claimNext({ claimMs: config.claimMs });
    if (!action) return false;
    if (action.attempts > config.maxAttempts) {
      await repository.fail({ id: action.id, attempts: action.attempts, retryMinutes: null });
      return true;
    }
    const recipient = await repository.recipient(action.user_id);
    if (!recipient) {
      await repository.fail({ id: action.id, attempts: action.attempts, retryMinutes: null });
      return true;
    }
    const token = randomBytes(32).toString('base64url');
    const stored = await repository.storeToken({
      id: action.id,
      attempts: action.attempts,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      tokenMinutes: config.tokenMinutes,
    });
    if (!stored) return true;
    const link = `${config.origin}/pages/restablecer.html#token=${token}`;
    try {
      await mailer.send({
        to: recipient,
        subject: 'Restablece tu contraseña',
        text: `Solicitaste restablecer tu contraseña. Abre este enlace dentro de ${config.tokenMinutes} minutos: ${link}\nSi no hiciste esta solicitud, ignora este mensaje.`,
        notificationId: randomUUID(),
      });
      await repository.accept({ id: action.id, attempts: action.attempts });
    } catch (error) {
      const permanent = ['MAIL_PERMANENT_FAILURE', 'MAIL_NOT_ACCEPTED'].includes(error.code);
      const retryMinutes = permanent ? null : config.delays[action.attempts - 1] || null;
      await repository.fail({ id: action.id, attempts: action.attempts, retryMinutes });
    }
    return true;
  }

  async function runBatch() {
    await repository.pruneAttempts(config.retentionDays);
    for (let processed = 0; processed < 10; processed += 1) {
      if (!(await processNext())) return;
    }
  }

  return Object.freeze({ processNext, runBatch });
}

module.exports = createSendPasswordReset;
