const { createRuntime } = require('./dev-runtime.cjs');

const action = process.argv[2];
if (!['up', 'down', 'status'].includes(action)) {
  process.stderr.write('Uso: node frontend/scripts/dev.cjs up|down|status\n');
  process.exitCode = 1;
} else {
  const runtime = createRuntime({ port: process.env.FRONTEND_DEV_PORT || '8081' });
  try {
    if (action === 'up') {
      if (runtime.exists())
        throw new Error('El entorno ya existe; usa status o down antes de reiniciarlo.');
      runtime.compose(['config', '--quiet']);
      try {
        runtime.compose(['up', '-d', '--build', '--wait', '--wait-timeout', '120'], {
          stdio: 'inherit',
        });
      } catch (error) {
        runtime.compose(['down', '--remove-orphans'], { stdio: 'inherit' });
        throw error;
      }
      const binding = runtime.compose(['port', 'frontend', '8080']).trim();
      process.stdout.write(
        `transViaje local: http://${binding}\nDatos efímeros: down descarta la base local.\n`,
      );
    } else {
      runtime.compose(action === 'down' ? ['down', '--remove-orphans'] : ['ps', '-a'], {
        stdio: 'inherit',
      });
    }
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  } finally {
    runtime.dispose();
  }
}
