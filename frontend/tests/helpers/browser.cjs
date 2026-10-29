// Control de Chrome de pruebas: perfiles efímeros y resultados sin valores sensibles.
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

function cookieMetadata(line) {
  const parts = line.split(';').map((part) => part.trim());
  const attributes = parts.slice(1).map((part) => part.toLowerCase());
  return {
    name: parts[0].split('=')[0],
    httpOnly: attributes.includes('httponly'),
    secure: attributes.includes('secure'),
    sameSite: attributes.find((part) => part.startsWith('samesite=')),
    path: attributes.find((part) => part.startsWith('path=')),
    hasDomain: attributes.some((part) => part.startsWith('domain=')),
  };
}

async function openBrowser(origin) {
  if (new URL(origin).hostname !== '127.0.0.1') throw new Error('Solo se permite QA loopback');
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'transviaje-csrf-chrome-'));
  const browser = spawn(
    process.env.BROWSER_BIN || 'google-chrome',
    [
      '--headless=new',
      '--no-first-run',
      '--disable-background-networking',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  browser.on('error', () => {});
  let socket;
  async function close() {
    socket?.close();
    if (browser.pid && browser.exitCode === null) {
      const exited = once(browser, 'exit');
      browser.kill();
      await exited;
    }
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
        break;
      } catch {
        if (browser.exitCode !== null) throw new Error('Chrome terminó durante el arranque');
        await delay(100);
      }
    }
    if (!port) throw new Error('Chrome no habilitó depuración');
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('No se pudo conectar Chrome')), {
        once: true,
      });
    });
    let id = 0;
    const pending = new Map();
    const receipts = [];
    const outside = [];
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const task = pending.get(message.id);
        if (!task) return;
        clearTimeout(task.timer);
        pending.delete(message.id);
        if (message.error) task.reject(new Error('Falló el comando CDP de pruebas'));
        else task.resolve(message.result);
      }
      if (message.method === 'Network.responseReceivedExtraInfo') {
        const headers = message.params.headers;
        const cookies = Object.entries(headers).find(
          ([name]) => name.toLowerCase() === 'set-cookie',
        );
        if (cookies) receipts.push(cookies[1].split('\n').map(cookieMetadata));
      }
      if (message.method === 'Network.requestWillBeSent') {
        const url = new URL(message.params.request.url);
        if (url.origin !== origin) outside.push(url.origin);
      }
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        id += 1;
        const requestId = id;
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error('Tiempo de comando CDP agotado'));
        }, 15000);
        pending.set(requestId, { resolve, reject, timer });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails)
        throw new Error('Falló la evaluación de QA (detalles sensibles omitidos)');
      return result.result.value;
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.navigate', { url: origin });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (
        await evaluate(
          `document.readyState === 'complete' && location.origin === ${JSON.stringify(origin)}`,
        )
      ) {
        return { send, evaluate, receipts, outside, close };
      }
      await delay(50);
    }
    throw new Error('La portada de QA no cargó');
  } catch (error) {
    await close();
    throw error;
  }
}

module.exports = { openBrowser, cookieMetadata };
