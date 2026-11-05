const { normalizeEmail } = require('../domain/identity');
const { performance } = require('node:perf_hooks');
const { setTimeout: delay } = require('node:timers/promises');

function createRequestPasswordReset({
  repository,
  config,
  clock = () => performance.now(),
  pause = delay,
}) {
  return async ({ email, ip }) => {
    const started = clock();
    await repository.request({
      email: normalizeEmail(email),
      ip,
      ipMax: config.resetIpMax,
      emailMax: config.resetEmailMax,
      windowMinutes: config.resetWindowMinutes,
      cooldownSeconds: config.resetCooldownSeconds,
    });
    const remaining = config.resetResponseFloorMs - (clock() - started);
    if (remaining > 0) await pause(remaining);
  };
}

module.exports = createRequestPasswordReset;
