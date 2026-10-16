const createApp = require('./app');
const logger = require('./shared/logger');

const DEFAULT_PORT = 3000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

const app = createApp();

app.listen(PORT, () => {
  logger.info(`Servidor escuchando en el puerto ${PORT}`);
});
