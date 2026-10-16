const AuthError = require('../domain/auth-error');
const MAX_KEYS = 10000;
function createLimiter(config, clock = () => Date.now()) {
  const entries = new Map();
  function sweep(now) {
    for (const [key, value] of entries) {
      if (!value.pending && now >= value.resetAt && now >= value.lockUntil) entries.delete(key);
    }
  }
  function entry(key, now) {
    if (!entries.has(key)) {
      if (entries.size >= MAX_KEYS) throw new AuthError('TOO_MANY_ATTEMPTS');
      entries.set(key, { failures: 0, pending: 0, resetAt: now + config.windowMs, lockUntil: 0 });
    }
    return entries.get(key);
  }
  return {
    begin(email, ip) {
      const now = clock();
      sweep(now);
      const account = entry(`account:${email}`, now);
      const address = entry(`ip:${ip}`, now);
      for (const [item, max] of [
        [account, config.accountMax],
        [address, config.ipMax],
      ]) {
        if (now < item.lockUntil || item.failures + item.pending >= max)
          throw new AuthError('TOO_MANY_ATTEMPTS');
      }
      account.pending++;
      address.pending++;
      let done = false;
      return (outcome) => {
        if (done) return;
        done = true;
        for (const [item, max] of [
          [account, config.accountMax],
          [address, config.ipMax],
        ]) {
          item.pending--;
          if (outcome === 'failure') {
            item.failures++;
            if (item.failures >= max) item.lockUntil = clock() + config.lockMs;
          }
        }
        if (outcome === 'success') {
          account.failures = 0;
          account.lockUntil = 0;
        }
      };
    },
  };
}
module.exports = createLimiter;
