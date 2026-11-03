const { PassThrough } = require('node:stream');
const { setImmediate } = require('node:timers/promises');
const readCredentials = require('../../../scripts/bootstrap-admin-input');

function terminalFixture() {
  const input = new PassThrough();
  input.isTTY = true;
  const output = new PassThrough();
  let shown = '';
  output.on('data', (chunk) => {
    shown += chunk.toString();
  });
  return { input, output, shown: () => shown };
}

test.each(['\n', '\r\n'])(
  'el pegado conjunto con separador %j conserva la contraseña y no la muestra',
  async (separator) => {
    const terminal = terminalFixture();
    const credentials = { email: 'admin@example.ec', password: '  clave-ficticia-á😀-larga  ' };
    try {
      const result = readCredentials(terminal.input, terminal.output);
      // Terminar el stream evita que una regresión quede esperando otra contraseña.
      terminal.input.end(credentials.email + separator + credentials.password + separator);
      await expect(result).resolves.toEqual(credentials);
      expect(terminal.shown()).not.toContain(credentials.password.trim());
    } finally {
      terminal.input.destroy();
      terminal.output.destroy();
    }
  },
);

test('oculta también el inicio de contraseña que llega junto con el email', async () => {
  const terminal = terminalFixture();
  const prefix = 'inicio-secreto-ficticio';
  const suffix = '-resto-de-la-clave';
  try {
    const result = readCredentials(terminal.input, terminal.output);
    terminal.input.write('admin@example.ec\n' + prefix);
    await setImmediate();
    expect(terminal.shown()).not.toContain(prefix);
    terminal.input.end(suffix + '\n');
    await expect(result).resolves.toEqual({
      email: 'admin@example.ec',
      password: prefix + suffix,
    });
  } finally {
    terminal.input.destroy();
    terminal.output.destroy();
  }
});

test.each(['fin de entrada', 'Ctrl+C'])(
  'cancelar con %s durante la contraseña no revela lo escrito',
  async (cancellation) => {
    const terminal = terminalFixture();
    const password = 'fragmento-secreto-ficticio';
    try {
      const result = readCredentials(terminal.input, terminal.output);
      const assertion = expect(result).rejects.toThrow('Entrada cancelada.');
      terminal.input.write('admin@example.ec\n');
      await setImmediate();
      terminal.input.write(password);
      if (cancellation === 'Ctrl+C') terminal.input.write('\u0003');
      else terminal.input.end();
      await assertion;
      expect(terminal.shown()).not.toContain(password);
      expect(terminal.input.isPaused()).toBe(true);
    } finally {
      terminal.input.destroy();
      terminal.output.destroy();
    }
  },
);
