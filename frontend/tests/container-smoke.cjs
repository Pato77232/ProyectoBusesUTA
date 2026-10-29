// FRONT-01 T2.1: empaquetado y HTTP reales con Docker, sin paquetes adicionales.
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '../..');
const image = 'busesuta-frontend:t2.1';
const container = `busesuta-front01-t21-${process.pid}`;

function docker(...args) {
  return execFileSync('docker', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function ready(origin) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.status === 200) return;
    } catch {
      // El socket puede no estar abierto todavía durante el arranque.
    }
    await delay(100);
  }
  throw new Error('Nginx no inició en el tiempo esperado');
}

async function main() {
  let started = false;
  try {
    docker('build', '-t', image, 'frontend');
    docker('run', '--rm', '--entrypoint', 'nginx', image, '-t');
    const user = docker('image', 'inspect', image, '--format', '{{.Config.User}}');
    assert.equal(user, 'nginx', 'El servidor debe ejecutarse sin root');
    const files = docker(
      'run',
      '--rm',
      '--entrypoint',
      'find',
      image,
      '/usr/share/nginx/html',
      '-type',
      'f',
    );
    assert.doesNotMatch(files, /README|DESIGN|provenance|tests\/|50x\.html/);
    for (const license of ['bootstrap-5.3.8/LICENSE', 'plus-jakarta-sans/OFL.txt']) {
      assert.ok(files.includes(license), 'Las licencias de recursos deben conservarse');
    }

    docker(
      'run',
      '--rm',
      '-d',
      '--name',
      container,
      '--read-only',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=16m,mode=1777',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges:true',
      '-p',
      '127.0.0.1::8080',
      image,
    );
    started = true;
    const binding = docker('port', container, '8080/tcp');
    assert.match(binding, /^127\.0\.0\.1:\d+$/);
    const origin = `http://${binding}`;
    await ready(origin);
    const page = await fetch(origin);
    assert.match(page.headers.get('content-type'), /^text\/html/);
    assert.match(await page.text(), /<title>transViaje/);
    for (const [resource, mime] of [
      ['/src/styles/app.css', 'text/css'],
      ['/assets/brand/logo-transviaje.png', 'image/png'],
      ['/assets/favicon.svg', 'image/svg+xml'],
      ['/assets/vendor/plus-jakarta-sans/PlusJakartaSans.ttf', 'font/ttf'],
      ['/assets/vendor/bootstrap-5.3.8/bootstrap.min.css', 'text/css'],
    ]) {
      const response = await fetch(origin + resource);
      assert.equal(response.status, 200, resource);
      assert.equal(response.headers.get('content-type').split(';')[0], mime, resource);
    }
    for (const resource of [
      '/no-existe',
      '/src/styles/no-existe.css',
      '/README.md',
      '/DESIGN.md',
      '/tests/smoke.cjs',
      '/assets/brand/README.md',
      '/assets/vendor/plus-jakarta-sans/provenance.json',
      '/api/v10',
    ]) {
      assert.equal((await fetch(origin + resource)).status, 404, resource);
    }
    for (const resource of ['/api/v1', '/api/v1/health', '/api/v1/no-existe']) {
      const response = await fetch(origin + resource);
      assert.equal(response.status, 503, resource);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await response.json()).error.code, 'API_NOT_CONNECTED');
    }
    assert.equal((await fetch(origin + '/assets/')).status, 403, 'Sin listado de directorios');
    const browser = spawnSync(process.execPath, ['frontend/tests/smoke.cjs'], {
      cwd: root,
      env: { ...process.env, QA_BASE_URL: origin },
      stdio: 'inherit',
    });
    assert.equal(browser.status, 0, 'Las pruebas de navegador deben pasar sobre Nginx');
    process.stdout.write(
      'Aprobado: imagen, usuario, recursos/MIME, exclusiones, 404 y API pendiente\n',
    );
  } finally {
    if (started) docker('rm', '-f', container);
  }
}

main().catch((error) => {
  process.stderr.write(error.stack + '\n');
  process.exitCode = 1;
});
