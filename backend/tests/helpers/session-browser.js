class SessionBrowser {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
    this.csrf = '';
  }
  async request(path, method = 'GET', body, csrf = this.csrf) {
    const headers = {
      'Content-Type': 'application/json',
      cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    };
    if (method !== 'GET') headers['X-CSRF-Token'] = csrf;
    const response = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [part] = cookie.split(';');
      const index = part.indexOf('=');
      this.cookies.set(part.slice(0, index), part.slice(index + 1));
    }
    return response;
  }
  async token() {
    this.csrf = (await (await this.request('/api/v1/auth/csrf')).json()).csrfToken;
  }
  async login(email, password) {
    await this.token();
    const response = await this.request('/api/v1/auth/login', 'POST', { email, password });
    if (response.status !== 200) throw new Error('No se pudo autenticar el usuario de prueba.');
    await this.token();
  }
}

module.exports = SessionBrowser;
