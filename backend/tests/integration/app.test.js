const http = require('node:http');
const createApp = require('../../src/app');

let server;
let baseUrl;

beforeAll(async () => {
  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => {
    server.close(resolve);
  });
});

describe('API Express (INFRA-01 T2)', () => {
  it('GET /api/v1/health responde 200 con estado ok', async () => {
    // Arrange
    // Act
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok' });
  });

  it('una ruta desconocida responde 404 con el formato único de error', async () => {
    // Arrange
    // Act
    const response = await fetch(`${baseUrl}/api/v1/ruta-que-no-existe`);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' } });
  });

  it('un cuerpo JSON malformado responde 400 INVALID_JSON', async () => {
    // Arrange
    // Act
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ esto no es json',
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body).toEqual({ error: { code: 'INVALID_JSON', message: 'El cuerpo JSON no es válido.' } });
  });

  it('no expone la cabecera x-powered-by', async () => {
    // Arrange
    // Act
    const response = await fetch(`${baseUrl}/api/v1/health`);

    // Assert
    expect(response.headers.get('x-powered-by')).toBeNull();
  });
});
