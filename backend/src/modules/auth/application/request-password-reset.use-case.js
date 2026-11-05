const { normalizeEmail } = require('../domain/identity');

function createRequestPasswordReset({ repository, config }) {
  return async ({ email, ip }) =>
    repository.request({
      email: normalizeEmail(email),
      ip,
      ipMax: config.resetIpMax,
      emailMax: config.resetEmailMax,
      windowMinutes: config.resetWindowMinutes,
      cooldownSeconds: config.resetCooldownSeconds,
    });
}

module.exports = createRequestPasswordReset;
