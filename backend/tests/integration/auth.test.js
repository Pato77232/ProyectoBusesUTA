const http = require('node:http');
const { randomUUID } = require('node:crypto');
const createApp = require('../../src/app');
const {createAuthModule} = require('../../src/modules/auth');
const {createHasher} = require('../../src/modules/auth/infrastructure/password-hasher');
const {runMigration,testPool,clearAuth} = require('../helpers/database');
const jwt = require('jsonwebtoken');
const password = 'contraseña ficticia de prueba';
const env = {JWT_SECRET:'test-only-secret-not-for-production-123456789',JWT_EXPIRES_IN:'30m'};
let pool, server, url, userId, hash;
class Browser {
 constructor(){ this.cookies=new Map();this.csrf=''; }
 async request(path,method='GET',body,extra={}) {
   const headers={cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; '),...extra};
   if(method!=='GET') {headers['Content-Type']='application/json';headers['X-CSRF-Token']=extra['X-CSRF-Token'] ?? this.csrf;}
   const response=await fetch(url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
   for(const cookie of response.headers.getSetCookie()) {
     const first=cookie.split(';')[0];const split=first.indexOf('=');this.cookies.set(first.slice(0,split),first.slice(split+1));
   }
   return response;
 }
 async token(){const res=await this.request('/api/v1/auth/csrf');this.csrf=(await res.json()).csrfToken;}
 async login(email='client@example.ec',pass=password){return this.request('/api/v1/auth/login','POST',{email,password:pass});}
}
beforeAll(async()=>{runMigration();pool=testPool();hash=await (await createHasher()).hash(password);});
beforeEach(async()=>{
 await clearAuth(pool);userId=randomUUID();
 await pool.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,'client@example.ec',$2,'CUSTOMER')",[userId,hash]);
 const auth=await createAuthModule({pool,env});
 server=http.createServer(createApp({auth,pool,trustProxy:true}));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 url=`http://127.0.0.1:${server.address().port}`;
});
afterEach(async()=>{if(server) await new Promise(resolve=>server.close(resolve));});
afterAll(async()=>{if(pool) await pool.end();});
test('login crea sesión, claims y cookie HttpOnly/Lax con vigencia idéntica',async()=>{
 const browser=new Browser();await browser.token();const res=await browser.login(' CLIENT@EXAMPLE.EC ');
 expect(res.status).toBe(200);expect(await res.text()).toBe('');
 const cookie=res.headers.getSetCookie().find(c=>c.startsWith('access_token='));
 expect(cookie).toContain('HttpOnly');expect(cookie).toContain('SameSite=Lax');expect(cookie).not.toContain('Secure');
 const claims=jwt.verify(decodeURIComponent(browser.cookies.get('access_token')),env.JWT_SECRET);
 expect(claims.sub).toBe(userId);expect(claims.role).toBe('CUSTOMER');expect(claims.cooperative_id).toBeNull();
 const result=await pool.query('SELECT * FROM auth_sessions WHERE id=$1',[claims.sid]);
 expect(result.rows).toHaveLength(1);expect(result.rows[0].expires_at.getTime()).toBe(claims.exp*1000);
});
test('cookie lleva Secure con HTTPS detrás de proxy de loopback autorizado',async()=>{
 const browser=new Browser();await browser.token();const res=await browser.request('/api/v1/auth/login','POST',{email:'client@example.ec',password},{'X-Forwarded-Proto':'https'});
 expect(res.status).toBe(200);expect(res.headers.get('set-cookie')).toContain('Secure');
});
test('CSRF ausente, manipulado o coincidente pero falsificado no permite login',async()=>{
 const browser=new Browser();expect((await browser.login()).status).toBe(403);
 await browser.token();browser.csrf+='x';expect((await browser.login()).status).toBe(403);
 browser.cookies.set('csrf_token','arbitrario');browser.csrf='arbitrario';expect((await browser.login()).status).toBe(403);
 expect((await pool.query('SELECT * FROM auth_sessions')).rows).toHaveLength(0);
});
test('cuenta inexistente y contraseña incorrecta son indistinguibles',async()=>{
 const browser=new Browser();await browser.token();const a=await browser.login('missing@example.ec');const b=await browser.login('client@example.ec','contraseña incorrecta larga');
 expect(a.status).toBe(401);expect(b.status).toBe(401);expect(await a.json()).toEqual(await b.json());
});
test('valida campos y rechaza rol/cooperativa suministrados en el cuerpo',async()=>{
 const browser=new Browser();await browser.token();
 for(const body of [{},{email:'bad',password},{email:'client@example.ec',password:'short'},{email:'client@example.ec',password,role:'SYSTEM_ADMIN'}]) {
 expect((await browser.request('/api/v1/auth/login','POST',body)).status).toBe(400);
 }
});
test('bloquea sexto intento por cuenta, incluso con contraseña correcta',async()=>{
 const browser=new Browser();await browser.token();for(let i=0;i<5;i++)expect((await browser.login('client@example.ec','contraseña equivocada larga')).status).toBe(401);
 expect((await browser.login()).status).toBe(429);
});
test('bloquea la IP tras 20 fallos distribuidos entre cuentas',async()=>{
 const browser=new Browser();await browser.token();for(let i=0;i<20;i++)expect((await browser.login(`missing${i}@example.ec`)).status).toBe(401);
 expect((await browser.login()).status).toBe(429);
});
module.exports = {Browser};
