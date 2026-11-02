const readline = require('node:readline');
const { Writable } = require('node:stream');
const MAX_INPUT_BYTES = 4096;
async function readCredentials(input = process.stdin, output = process.stdout) {
  if (!input.isTTY) {
    const chunks = [];
    let size = 0;
    for await (const chunk of input) {
      size += Buffer.byteLength(chunk);
      if (size > MAX_INPUT_BYTES) throw new Error('Entrada inválida.');
      chunks.push(Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  let hidden = false;
  const terminalOutput = new Writable({
    write(chunk, encoding, done) {
      if (!hidden) output.write(chunk, encoding);
      done();
    },
  });
  const terminal = readline.createInterface({
    input,
    output: terminalOutput,
    terminal: true,
    historySize: 0,
  });
  terminal.on('SIGINT', () => terminal.close());
  try {
    return await new Promise((resolve, reject) => {
      terminal.once('close', () => reject(new Error('Entrada cancelada.')));
      terminal.question('Email del administrador: ', (email) => {
        // Cambiar de pregunta sin esperar permite ocultar el resto del mismo pegado.
        hidden = true;
        output.write('Contraseña (entrada oculta): ');
        terminal.question('', (password) => {
          terminal.pause();
          resolve({ email, password });
        });
      });
    });
  } finally {
    terminal.close();
    output.write('\n');
  }
}
module.exports = readCredentials;
