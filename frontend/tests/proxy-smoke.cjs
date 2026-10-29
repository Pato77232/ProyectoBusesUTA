// FRONT-01 T2.2: arranque real, rutas y recuperación; cookies de navegador en T2.3.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { createRuntime, docker } = require('../scripts/dev-runtime.cjs');

async function waitFor(check, message, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (await check()) return;
    } catch {
      // El estado puede transicionar durante arranque o cambio de dirección DNS.
    }
    await delay(300);
  }
  throw new Error(message);
}

async function request(origin, route = '/') {
  return fetch(origin + route, { signal: AbortSignal.timeout(15000) });
}

async function main() {
  const runtime = createRuntime({ project: `transviaje-frontend-qa-${process.pid}`, port: '0' });
  let holder;
  let owned = false;
  const inspect = (id, field) => docker(['inspect', '--format', field, id]).trim();
  const serviceId = (name) => runtime.compose(['ps', '-aq', name]).trim();
  try {
    assert.equal(runtime.exists(), false, 'El proyecto de prueba debe ser nuevo');
    owned = true;
    runtime.compose(['config', '--quiet']);
    process.stdout.write('T2.2: construye frontend y backend desde sus Dockerfiles\n');
    runtime.compose(['build']);
    // Demuestra que la portada puede iniciar sin backend ni nombre DNS disponible.
    runtime.compose(['up', '-d', '--wait', '--wait-timeout', '60', 'frontend']);
    const binding = runtime.compose(['port', 'frontend', '8080']).trim();
    assert.match(binding, /^127\.0\.0\.1:\d+$/);
    const origin = `http://${binding}`;
    const frontendId = serviceId('frontend');
    const frontendStarted = inspect(frontendId, '{{.State.StartedAt}}');
    assert.equal((await request(origin)).status, 200);
    let failure = await request(origin, '/api/v1/health');
    assert.ok([502, 503, 504].includes(failure.status), 'La API no puede fingir estar disponible');
    process.stdout.write('Aprobado: portada con backend ausente y error HTTP explícito\n');

    runtime.compose(['up', '-d', '--wait', '--wait-timeout', '120']);
    const healthy = async () => {
      const response = await request(origin, '/api/v1/health?probe=t22');
      return response.status === 200 && (await response.json()).status === 'ok';
    };
    await waitFor(healthy, 'El health real no respondió por el proxy');
    assert.equal(inspect(serviceId('migrate'), '{{.State.ExitCode}}'), '0');
    for (const name of ['db', 'backend']) {
      const id = serviceId(name);
      const bindings = JSON.parse(inspect(id, '{{json .HostConfig.PortBindings}}'));
      assert.ok(!bindings || Object.keys(bindings).length === 0, `${name} sin puertos al host`);
      const mounts = JSON.parse(inspect(id, '{{json .Mounts}}'));
      assert.equal(
        mounts.some((mount) => mount.Type === 'volume'),
        false,
        'Sin volúmenes de datos',
      );
    }
    const backendId = serviceId('backend');
    const mode = runtime
      .compose([
        'exec',
        '-T',
        'backend',
        'node',
        '-e',
        'process.stdout.write(process.env.NODE_ENV + ":" + process.env.TRUST_PROXY)',
      ])
      .trim();
    assert.equal(mode, 'development:false');
    for (const route of ['/api/v1', '/api/v1/no-existe?probe=t22']) {
      const response = await request(origin, route);
      assert.equal(response.status, 404, route);
      assert.match(response.headers.get('content-type'), /^application\/json/);
      assert.equal((await response.json()).error.code, 'NOT_FOUND');
    }
    const denied = await request(origin, '/api/v1/auth/me');
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get('content-type'), /^application\/json/);
    for (const route of ['/api/v10', '/README.md', '/scripts/dev.cjs', '/no-existe']) {
      assert.equal((await request(origin, route)).status, 404, route);
    }
    const browser = spawnSync(process.execPath, ['frontend/tests/smoke.cjs'], {
      cwd: require('node:path').resolve(__dirname, '../..'),
      env: { ...process.env, QA_BASE_URL: origin },
      stdio: 'inherit',
    });
    assert.equal(browser.status, 0, 'La portada debe conservar sus comprobaciones de navegador');
    process.stdout.write('Aprobado: migraciones, health real, 404/401, aislamiento y navegador\n');

    runtime.compose(['stop', 'backend']);
    assert.equal((await request(origin)).status, 200);
    const before = Date.now();
    failure = await request(origin, '/api/v1/health');
    assert.ok([502, 503, 504].includes(failure.status));
    assert.ok(Date.now() - before < 15000, 'El fallo del upstream debe tener espera acotada');
    runtime.compose(['start', 'backend']);
    await waitFor(healthy, 'La API no se recuperó al reiniciar backend');

    // Obliga a que la nueva instancia use otra IP; evita un falso positivo de DNS.
    const networks = JSON.parse(inspect(backendId, '{{json .NetworkSettings.Networks}}'));
    const [network, details] = Object.entries(networks)[0];
    const oldAddress = details.IPAddress;
    const backendImage = inspect(backendId, '{{.Config.Image}}');
    runtime.compose(['rm', '-s', '-f', 'backend']);
    holder = `${runtime.project}-ip-holder`;
    docker([
      'run',
      '--rm',
      '-d',
      '--name',
      holder,
      '--network',
      network,
      '--ip',
      oldAddress,
      '--entrypoint',
      'node',
      backendImage,
      '-e',
      'setTimeout(() => {}, 180000)',
    ]);
    runtime.compose(['up', '-d', '--no-deps', 'backend']);
    const newNetworks = JSON.parse(
      inspect(serviceId('backend'), '{{json .NetworkSettings.Networks}}'),
    );
    assert.notEqual(newNetworks[network].IPAddress, oldAddress, 'Se exige un cambio real de IP');
    await waitFor(healthy, 'Nginx no recuperó el backend con otra IP');
    assert.equal(serviceId('frontend'), frontendId, 'No recrear Nginx para recuperar la API');
    assert.equal(
      inspect(frontendId, '{{.State.StartedAt}}'),
      frontendStarted,
      'No reiniciar Nginx',
    );
    process.stdout.write('Aprobado: caída, reinicio y cambio real de IP sin reiniciar Nginx\n');
  } finally {
    try {
      if (holder) docker(['rm', '-f', holder]);
    } finally {
      try {
        if (owned) runtime.compose(['down', '--remove-orphans']);
      } finally {
        runtime.dispose();
      }
    }
  }
}

main().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
