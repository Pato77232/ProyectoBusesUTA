const pino = require('pino');

const DEFAULT_LOG_LEVEL = 'info';

/** Logger compartido del backend. Prohibido usar console.log (docs/conventions.md). */
const logger = pino({
  level: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
});

module.exports = logger;
