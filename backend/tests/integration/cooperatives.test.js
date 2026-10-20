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
let pool,hash,server,url,baselineCooperatives;
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
 assertTestDatabase();await pool.query('TRUNCATE auth_sessions, users, cooperatives CASCADE');
 baselineCooperatives=(await pool.query('INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING *',['Cooperativa inicial','0099999999999'])).rows;
 for(const role of ['SYSTEM_ADMIN','CUSTOMER','COOPERATIVE_ADMIN','CLERK']){
  const cooperativeId=['COOPERATIVE_ADMIN','CLERK'].includes(role)?baselineCooperatives[0].id:null;
  await pool.query('INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',[`${role.toLowerCase()}@example.ec`,hash,role,cooperativeId]);
 }
 const auth=await createAuthModule({pool,env});const tenants=createTenantsModule({pool,auth});
 server=http.createServer(createApp({auth,tenants,pool}));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 url=`http://127.0.0.1:${server.address().port}`;
});
afterEach(async()=>{if(server)await new Promise(resolve=>server.close(resolve));});
afterAll(async()=>{if(pool)await pool.end();});
test('SYSTEM_ADMIN crea y persiste cooperativa sin crear administrador',async()=>{
 const browser=new Browser();await browser.signIn();
 const res=await browser.create({...payload,name:'  Cooperativa UTA  ',email:' CONTACTO@EXAMPLE.EC ',phone:'  0991234567  ',address:'  Ambato  '});
 expect(res.status).toBe(201);const {cooperative}=await res.json();
 expect(cooperative).toEqual({id:expect.any(String),name:'Cooperativa UTA',ruc:payload.ruc,email:'contacto@example.ec',phone:'0991234567',address:'Ambato',created_at:expect.any(String),updated_at:expect.any(String)});
 expect((await pool.query('SELECT id FROM cooperatives WHERE ruc=$1',[payload.ruc])).rows[0].id).toBe(cooperative.id);
 expect((await pool.query('SELECT count(*)::int AS count FROM users')).rows[0].count).toBe(4);
});
test('opcionales omitidos o vacíos se guardan como null',async()=>{
 const browser=new Browser();await browser.signIn();const res=await browser.create({...payload,email:' ',phone:null});
 expect(res.status).toBe(201);expect((await res.json()).cooperative).toMatchObject({email:null,phone:null,address:null});
});
test.each(['CUSTOMER','COOPERATIVE_ADMIN','CLERK'])('%s recibe 403 y no escribe',async(role)=>{
 const browser=new Browser();await browser.signIn(role);expect((await browser.create()).status).toBe(403);
 expect((await pool.query('SELECT * FROM cooperatives')).rows).toEqual(baselineCooperatives);
});
test('sesión ausente, revocada o vencida no permite crear',async()=>{
 const browser=new Browser();expect((await browser.create()).status).toBe(401);
 await browser.signIn();await pool.query('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP');
 expect((await browser.create()).status).toBe(401);
 await pool.query("UPDATE auth_sessions SET revoked_at=NULL, expires_at=CURRENT_TIMESTAMP-interval '1 minute'");
 expect((await browser.create()).status).toBe(401);
 expect((await pool.query('SELECT * FROM cooperatives')).rows).toEqual(baselineCooperatives);
});
test('CSRF ausente o manipulado bloquea el alta',async()=>{
 const browser=new Browser();await browser.signIn();
 expect((await browser.create(payload,'')).status).toBe(403);expect((await browser.create(payload,'fake')).status).toBe(403);
 expect((await pool.query('SELECT * FROM cooperatives')).rows).toEqual(baselineCooperatives);
});
test('rechaza datos inválidos, id y permisos aportados en el cuerpo',async()=>{
 const browser=new Browser();await browser.signIn();
 for(const body of [{},{...payload,name:' '},{...payload,ruc:'123'},{...payload,ruc:1234567890123},{...payload,email:'bad'},{...payload,id:randomUUID()},{...payload,cooperative_id:randomUUID()},{...payload,role:'SYSTEM_ADMIN'}]){
  const res=await browser.create(body);expect(res.status).toBe(400);expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
 }
 expect((await pool.query('SELECT * FROM cooperatives')).rows).toEqual(baselineCooperatives);
});
test('RUC duplicado y solicitudes simultáneas producen una sola fila',async()=>{
 const browser=new Browser();await browser.signIn();
 const results=await Promise.all([browser.create(),browser.create()]);
 expect(results.map(res=>res.status).sort()).toEqual([201,409]);
 expect(await results.find(res=>res.status===409).json()).toEqual({error:{code:'COOPERATIVE_ALREADY_EXISTS',message:'Ya existe una cooperativa con ese RUC.'}});
 expect((await browser.create({...payload,ruc:` ${payload.ruc} `})).status).toBe(409);
 expect((await pool.query('SELECT * FROM cooperatives')).rows).toHaveLength(baselineCooperatives.length+1);
 expect((await pool.query('SELECT * FROM cooperatives WHERE id=$1',[baselineCooperatives[0].id])).rows).toEqual(baselineCooperatives);
 expect((await pool.query('SELECT * FROM cooperatives WHERE ruc=$1',[payload.ruc])).rows).toHaveLength(1);
});
