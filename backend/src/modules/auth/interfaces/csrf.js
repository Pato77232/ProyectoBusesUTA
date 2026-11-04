const { randomBytes, createHmac, timingSafeEqual } = require('node:crypto');
const { readCookie, cookieOptions } = require('./cookies');
const TTL_SECONDS = 600;
// El prefijo impide que un subdominio inyecte la cookie de vínculo en producción.
function browserCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Host-csrf_browser' : 'csrf_browser';
}
function equal(a, b) {
  return (
    typeof a === 'string' &&
    typeof b === 'string' &&
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
function createCsrf(secret, tokens, clock = () => Date.now()) {
  function binding(req) {
    try {
      return tokens.verify(readCookie(req, 'access_token')).sid;
    } catch {
      return 'anonymous';
    }
  }
  function sign(payload, browser, session) {
    return createHmac('sha256', secret)
      .update(JSON.stringify(['csrf', payload, browser, session]))
      .digest('hex');
  }
  return {
    issue(req, res) {
      const browser = randomBytes(32).toString('hex');
      const payload = `${randomBytes(32).toString('hex')}.${Math.floor(clock() / 1000) + TTL_SECONDS}`;
      const csrfToken = `${payload}.${sign(payload, browser, binding(req))}`;
      res.cookie(browserCookieName(), browser, {
        ...cookieOptions(req),
        maxAge: TTL_SECONDS * 1000,
      });
      res.cookie('csrf_token', csrfToken, {
        ...cookieOptions(req),
        httpOnly: false,
        maxAge: TTL_SECONDS * 1000,
      });
      res.set('Cache-Control', 'no-store').json({ csrfToken });
    },
    protect(req, res, next) {
      const token = req.get('X-CSRF-Token');
      const browser = readCookie(req, browserCookieName());
      const match =
        typeof token === 'string' && /^([a-f0-9]{64}\.\d+)\.([a-f0-9]{64})$/.exec(token);
      const expires = match && Number(match[1].split('.')[1]);
      if (
        !browser ||
        !match ||
        !equal(token, readCookie(req, 'csrf_token')) ||
        expires <= Math.floor(clock() / 1000) ||
        !equal(match[2], sign(match[1], browser, binding(req)))
      ) {
        return res
          .status(403)
          .json({ error: { code: 'CSRF_TOKEN_INVALID', message: 'Token CSRF inválido.' } });
      }
      next();
    },
  };
}
module.exports = createCsrf;
