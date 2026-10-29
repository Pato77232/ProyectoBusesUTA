// Entorno local efímero de FRONT-01; no lee archivos .env ni imprime credenciales.
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const defaultProject = 'transviaje-frontend-dev';

function docker(args, options = {}) {
  return execFileSync('docker', args, { cwd: root, encoding: 'utf8', ...options });
}

function createRuntime({ project = defaultProject, port = '8081' } = {}) {
  if (!/^\d+$/.test(String(port)) || Number(port) > 65535) {
    throw new Error('FRONTEND_DEV_PORT debe ser un puerto entre 0 y 65535.');
  }
  if (!/^transviaje-frontend-(dev|qa-[a-z0-9-]+)$/.test(project)) {
    throw new Error('Proyecto local no permitido.');
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'transviaje-compose-'));
  const emptyFile = path.join(directory, 'empty-config');
  fs.writeFileSync(emptyFile, '', { mode: 0o600 });
  const password = randomBytes(24).toString('hex');
  const env = {
    ...process.env,
    FRONTEND_DEV_PORT: String(port),
    FRONTEND_DEV_DB_PASSWORD: password,
    FRONTEND_DEV_DATABASE_URL: `postgres://frontend_dev:${encodeURIComponent(password)}@db:5432/transviaje_frontend_dev`,
    FRONTEND_DEV_JWT_SECRET: randomBytes(48).toString('hex'),
  };
  const compose = (args, options = {}) =>
    docker(
      [
        'compose',
        '--env-file',
        emptyFile,
        '-p',
        project,
        '-f',
        'docker-compose.frontend-dev.yml',
        ...args,
      ],
      { env, ...options },
    );
  return {
    compose,
    project,
    exists: () =>
      docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]).trim() !==
      '',
    dispose: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

module.exports = { createRuntime, docker, defaultProject };
