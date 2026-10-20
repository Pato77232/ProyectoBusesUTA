const http=require('node:http');
const {randomUUID}=require('node:crypto');
const createApp=require('../../src/app');
const {createAuthModule}=require('../../src/modules/auth');
const {createTenantsModule}=require('../../src/modules/tenants');
const {createHasher}=require('../../src/modules/auth/infrastructure/password-hasher');
const {runMigration,testPool}=require('../helpers/database');
const {assertTestDatabase}=require('../../scripts/test-database');
const PASSWORD='contraseña ficticia cooperativas';
const env={JWT_SECRET:'test-only-cooperatives-secret-not-for-production-12345'};
const payload={name:'Cooperativa de prueba',ruc:'0012345678901'};
let pool,hash,server,url,baselineCooperatives,targetId;
class Browser {
 constructor(){this.cookies=new Map();this.csrf='';}
 async request(path,method='GET',body,csrf=this.csrf) {
  const headers={cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')};
  if(method!=='GET'){headers['Content-Type']='application/json';headers['X-CSRF-Token']=csrf;}
  const res=await fetch(url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  for(const cookie of res.headers.getSetCookie()) {
   const first=cookie.split(';')[0];const i=first.indexOf('=');this.cookies.set(first.slice(0,i),first.slice(i+1));
  }
  return res;
 }
 async token(){const res=await this.request('/api/v1/auth/csrf');this.csrf=(await res.json()).csrfToken;}
 async signIn(role='SYSTEM_ADMIN'){
  await this.token();const res=await this.request('/api/v1/auth/login','POST',{email:`${role.toLowerCase()}@example.ec`,password:PASSWORD});
  expect(res.status).toBe(200);await this.token();
 }
 create(body=payload,csrf=this.csrf){return this.request('/api/v1/cooperatives','POST',body,csrf);}
}
beforeAll(async()=>{runMigration();pool=testPool();hash=await(await createHasher()).hash(PASSWORD);});
beforeEach(async()=>{
 assertTestDatabase();await pool.query('TRUNCATE auth_sessions, users, cooperatives, frequency_segment_prices, frequency_stops, frequencies');
 baselineCooperatives=(await pool.query('INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING *',['Cooperativa inicial','0099999999999'])).rows;
 for(const role of ['SYSTEM_ADMIN','CUSTOMER','COOPERATIVE_ADMIN','CLERK']){
  const cooperativeId=['COOPERATIVE_ADMIN','CLERK'].includes(role)?baselineCooperatives[0].id:null;
  await pool.query('INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',[`${role.toLowerCase()}@example.ec`,hash,role,cooperativeId]);
 }
 targetId=(await pool.query('INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING id',['Destino','0088888888888'])).rows[0].id;
 const auth=await createAuthModule({pool,env});const tenants=createTenantsModule({pool,auth});
 server=http.createServer(createApp({auth,tenants,pool}));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 url=`http://127.0.0.1:${server.address().port}`;
});
afterEach(async()=>{if(server)await new Promise(resolve=>server.close(resolve));});
afterAll(async()=>{if(pool)await pool.end();});

const adminBody={email:'nuevo@example.ec',password:PASSWORD};
async function create(browser,body=adminBody,id=targetId,csrf=browser.csrf){return browser.request(`/api/v1/cooperatives/${id}/admins`,'POST',body,csrf);}
async function users(){return (await pool.query('SELECT * FROM users ORDER BY id')).rows;}
test('crea administrador, conserva sesión del operador y permite login con contexto correcto',async()=>{
 const browser=new Browser();await browser.signIn();
 const sessions=(await pool.query('SELECT * FROM auth_sessions')).rows;
 const response=await create(browser,{...adminBody,email:' NUEVO@EXAMPLE.EC '});
 expect(response.status).toBe(201);
 const {user}=await response.json();
 expect(user).toEqual({id:expect.any(String),email:adminBody.email,role:'COOPERATIVE_ADMIN',cooperative_id:targetId});
 expect(response.headers.getSetCookie()).toEqual([]);
 expect((await pool.query('SELECT * FROM auth_sessions')).rows).toEqual(sessions);
 const row=(await pool.query('SELECT password_hash FROM users WHERE id=$1',[user.id])).rows[0];
 expect(row.password_hash).toMatch(/^\$argon2id\$/);
 expect(await(await createHasher()).verify(row.password_hash,PASSWORD)).toBe(true);
 const newcomer=new Browser();await newcomer.token();
 expect((await newcomer.request('/api/v1/auth/login','POST',adminBody)).status).toBe(200);
 expect(await(await newcomer.request('/api/v1/auth/me')).json()).toEqual({user});
});
test.each(['CUSTOMER','COOPERATIVE_ADMIN','CLERK'])('%s no crea administradores',async role=>{
 const browser=new Browser();await browser.signIn(role);const before=await users();
 expect((await create(browser)).status).toBe(403);expect(await users()).toEqual(before);
});
test('rechaza sesiones ausentes, revocadas y vencidas sin escrituras',async()=>{
 const browser=new Browser();const before=await users();expect((await create(browser)).status).toBe(401);
 await browser.signIn();await pool.query('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP');
 expect((await create(browser)).status).toBe(401);
 await pool.query("UPDATE auth_sessions SET revoked_at=NULL,expires_at=CURRENT_TIMESTAMP-interval '1 minute'");
 expect((await create(browser)).status).toBe(401);expect(await users()).toEqual(before);
});
test('CSRF inválido y cuerpos o UUID inválidos no escriben',async()=>{
 const browser=new Browser();await browser.signIn();const before=await users();
 for(const csrf of ['','fake'])expect((await create(browser,adminBody,targetId,csrf)).status).toBe(403);
 for(const body of [{},{...adminBody,password:'short'},{...adminBody,email:'bad'},{...adminBody,role:'SYSTEM_ADMIN'},{...adminBody,cooperative_id:targetId}])expect((await create(browser,body)).status).toBe(400);
 expect((await create(browser,adminBody,'invalid')).status).toBe(400);
 expect(await users()).toEqual(before);
});
test('cooperativa inexistente devuelve 404 sin crear usuario',async()=>{
 const browser=new Browser();await browser.signIn();const before=await users();const response=await create(browser,adminBody,randomUUID());
 expect(response.status).toBe(404);expect((await response.json()).error.code).toBe('COOPERATIVE_NOT_FOUND');expect(await users()).toEqual(before);
});
test('email normalizado existente no convierte la cuenta ni crea administrador',async()=>{
 const browser=new Browser();await browser.signIn();const before=await users();
 expect((await create(browser,{...adminBody,email:' CUSTOMER@EXAMPLE.EC '})).status).toBe(409);expect(await users()).toEqual(before);
});
test('altas simultáneas y segunda alta preservan un único administrador',async()=>{
 const browser=new Browser();await browser.signIn();const before=await users();
 const results=await Promise.all([create(browser),create(browser,{...adminBody,email:'otro@example.ec'})]);
 expect(results.map(r=>r.status).sort()).toEqual([201,409]);
 expect((await(await results.find(r=>r.status===409).json()).error).code).toBe('REGISTRATION_CONFLICT');
 const after=await users();expect(after).toHaveLength(before.length+1);expect(after).toEqual(expect.arrayContaining(before));
 expect((await create(browser,{...adminBody,email:'tercero@example.ec'})).status).toBe(409);expect(await users()).toEqual(after);
});
test('índice reversible conserva filas y rechaza duplicados previos sin borrarlos',async()=>{
 const before=await users();
 const applied=(await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC')).rows;
 const target='1792280002000-unique-cooperative-admin';
 expect(applied.map(row=>row.name)).toContain(target);
 for(const row of applied){runMigration('down');if(row.name===target)break;}
 expect(await users()).toEqual(before);
 const duplicate=(await pool.query("INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,'COOPERATIVE_ADMIN',$3) RETURNING id",['duplicado@example.ec',hash,baselineCooperatives[0].id])).rows[0];
 try {
  const incompatible=await users();
  expect(()=>runMigration()).toThrow();
  expect(await users()).toEqual(incompatible);
 } finally {
  await pool.query('DELETE FROM users WHERE id=$1',[duplicate.id]);
  runMigration();
 }
 expect(await users()).toEqual(before);
 await expect(pool.query("INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,'COOPERATIVE_ADMIN',$3)",['duplicado@example.ec',hash,baselineCooperatives[0].id])).rejects.toMatchObject({code:'23505',constraint:'users_cooperative_admin_unique'});
});
