const createCooperativeAdmin = require('./application/create-cooperative-admin.use-case');
const createClerk = require('./application/create-clerk.use-case');
const createAdminRouter = require('./interfaces/cooperative-admin-router');
const { randomUUID } = require('node:crypto');
const createAuthenticate = require('./application/authenticate.use-case');
const { authenticationMiddleware, authorize } = require('./interfaces/authenticate');
const createLogout = require('./application/logout.use-case');
const createRegisterCustomer = require('./application/register-customer.use-case');
const createLogin = require('./application/login.use-case');
const PgAuthRepository = require('./infrastructure/pg-auth.repository');
const PgPasswordResetRepository = require('./infrastructure/pg-password-reset.repository');
const createRequestPasswordReset = require('./application/request-password-reset.use-case');
const createSendPasswordReset = require('./application/send-password-reset.use-case');
const createConfirmPasswordReset = require('./application/confirm-password-reset.use-case');
const startPasswordResetWorker = require('./infrastructure/password-reset-worker');
const { readPasswordResetWorkerConfig } = require('./infrastructure/password-reset-worker-config');
const { createSmtpMailer } = require('../../shared/mail/smtp-mailer');
const createGuestEmailAccess = require('./application/guest-email-access');
const PgGuestEmailAccessRepository = require('./infrastructure/pg-guest-email-access.repository');
const readGuestAccessConfig = require('./infrastructure/guest-access-config');
const { createHasher } = require('./infrastructure/password-hasher');
const createTokens = require('./infrastructure/jwt-tokens');
const createLimiter = require('./infrastructure/memory-login-limiter');
const { readAuthConfig } = require('./infrastructure/auth-config');
const createCsrf = require('./interfaces/csrf');
const createRouter = require('./interfaces/auth-router');
async function createAuthModule({ pool, env = process.env, mailer }) {
  const config = readAuthConfig(env);
  const workerConfig = readPasswordResetWorkerConfig(env);
  const workerMailer = workerConfig.enabled ? mailer || createSmtpMailer(env) : null;
  if (workerConfig.enabled && !workerMailer.configured)
    throw new Error('El trabajador de recuperación requiere SMTP configurado.');
  const repository = new PgAuthRepository(pool);
  const resetRepository = new PgPasswordResetRepository(pool);
  const hasher = await createHasher();
  const tokens = createTokens(config);
  const limiter = createLimiter(config);
  const login = createLogin({ repository, hasher, tokens, limiter, newId: randomUUID });
  const csrf = createCsrf(config.secret, tokens);
  const authenticate = authenticationMiddleware(createAuthenticate({ repository, tokens }));
  return {
    cooperativeAdminRouter: createAdminRouter({
      authenticate,
      authorize,
      csrf,
      createAdmin: createCooperativeAdmin({ repository, hasher }),
    }),
    router: createRouter({
      login,
      csrf,
      authenticate,
      authorize,
      logout: createLogout({ repository }),
      register: createRegisterCustomer({ repository, hasher }),
      createClerk: createClerk({ repository, hasher }),
      requestPasswordReset: createRequestPasswordReset({
        repository: resetRepository,
        config,
      }),
      confirmPasswordReset: createConfirmPasswordReset({ repository: resetRepository, hasher }),
    }),
    authenticate,
    authorize,
    csrfProtection: csrf.protect,
    maintenance: Object.freeze({
      startPasswordResetWorker({ onFailure = () => {} } = {}) {
        if (!workerConfig.enabled) return null;
        const sender = createSendPasswordReset({
          repository: resetRepository,
          mailer: workerMailer,
          config: workerConfig,
        });
        return startPasswordResetWorker({
          runBatch: sender.runBatch,
          intervalMs: workerConfig.pollMs,
          onFailure,
        });
      },
    }),
  };
}
module.exports = { createAuthModule };

async function bootstrapSystemAdmin({ pool, credentials }) {
  const parseCredentials = require('./interfaces/bootstrap-credentials');
  const createBootstrapAdmin = require('./application/bootstrap-admin.use-case');
  const PgBootstrapRepository = require('./infrastructure/pg-bootstrap.repository');
  const input = parseCredentials(credentials);
  const hasher = await createHasher();
  return createBootstrapAdmin({ repository: new PgBootstrapRepository(pool), hasher })(input);
}
module.exports.bootstrapSystemAdmin = bootstrapSystemAdmin;
module.exports.createGuestEmailAccess = function createGuestAccessModule({
  pool,
  env = process.env,
  clock,
} = {}) {
  return createGuestEmailAccess({
    repository: new PgGuestEmailAccessRepository(pool),
    config: readGuestAccessConfig(env),
    clock,
  });
};
