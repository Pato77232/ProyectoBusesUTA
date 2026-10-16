const { randomUUID } = require('node:crypto');
const createAuthenticate = require('./application/authenticate.use-case');
const { authenticationMiddleware, authorize } = require('./interfaces/authenticate');
const createLogout = require('./application/logout.use-case');
const createRegisterCustomer = require('./application/register-customer.use-case');
const createLogin = require('./application/login.use-case');
const PgAuthRepository = require('./infrastructure/pg-auth.repository');
const { createHasher } = require('./infrastructure/password-hasher');
const createTokens = require('./infrastructure/jwt-tokens');
const createLimiter = require('./infrastructure/memory-login-limiter');
const { readAuthConfig } = require('./infrastructure/auth-config');
const createCsrf = require('./interfaces/csrf');
const createRouter = require('./interfaces/auth-router');
async function createAuthModule({ pool, env = process.env }) {
  const config = readAuthConfig(env);
  const repository = new PgAuthRepository(pool);
  const hasher = await createHasher();
  const tokens = createTokens(config);
  const limiter = createLimiter(config);
  const login = createLogin({ repository, hasher, tokens, limiter, newId: randomUUID });
  const csrf = createCsrf(config.secret, tokens);
  const authenticate = authenticationMiddleware(createAuthenticate({ repository, tokens }));
  return {
    router: createRouter({
      login,
      csrf,
      authenticate,
      logout: createLogout({ repository }),
      register: createRegisterCustomer({ repository, hasher }),
    }),
    authenticate,
    authorize,
    csrfProtection: csrf.protect,
  };
}
module.exports = { createAuthModule };
