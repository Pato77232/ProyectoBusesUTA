const createLogin = require('../../../src/modules/auth/application/login.use-case');
const createLimiter = require('../../../src/modules/auth/infrastructure/memory-login-limiter');
const {readAuthConfig} = require('../../../src/modules/auth/infrastructure/auth-config');
const {createHasher,HASH_OPTIONS} = require('../../../src/modules/auth/infrastructure/password-hasher');
const createTokens = require('../../../src/modules/auth/infrastructure/jwt-tokens');
const {randomUUID} = require('node:crypto');
function setup(user={id:randomUUID(),role:'CUSTOMER',cooperative_id:null,password_hash:'hash'}) {
  const repository={findByEmail:jest.fn().mockResolvedValue(user),createSession:jest.fn().mockResolvedValue()};
  const hasher={dummyHash:'dummy',verify:jest.fn().mockResolvedValue(true)};
  const tokens={issue:jest.fn().mockReturnValue({token:'token',expiresAt:new Date(10000)})};
  const finish=jest.fn(); const limiter={begin:jest.fn().mockReturnValue(finish)};
  return {repository,hasher,tokens,limiter,finish,login:createLogin({repository,hasher,tokens,limiter,newId:()=> 'sid'})};
}
test('login normaliza email y persiste la misma vigencia que el token',async()=>{
  const ctx=setup(); await expect(ctx.login({email:' A@EXAMPLE.COM ',password:'pass',ip:'ip'})).resolves.toEqual({token:'token',expiresAt:new Date(10000)});
  expect(ctx.repository.findByEmail).toHaveBeenCalledWith('a@example.com');
  expect(ctx.repository.createSession).toHaveBeenCalledWith(expect.objectContaining({id:'sid',expiresAt:new Date(10000)}));
  expect(ctx.finish).toHaveBeenCalledWith('success');
});
test('cuenta inexistente verifica hash ficticio y falla genéricamente',async()=>{
 const ctx=setup(null); await expect(ctx.login({email:'a@b.ec',password:'pass',ip:'ip'})).rejects.toMatchObject({code:'INVALID_CREDENTIALS'});
 expect(ctx.hasher.verify).toHaveBeenCalledWith('dummy','pass');expect(ctx.finish).toHaveBeenCalledWith('failure');
});
test('contraseña incorrecta no crea sesión',async()=>{
 const ctx=setup();ctx.hasher.verify.mockResolvedValue(false);
 await expect(ctx.login({email:'a@b.ec',password:'bad',ip:'ip'})).rejects.toMatchObject({code:'INVALID_CREDENTIALS'});
 expect(ctx.repository.createSession).not.toHaveBeenCalled();
});
test('error de persistencia libera intento sin contarlo como contraseña incorrecta',async()=>{
 const ctx=setup();ctx.repository.createSession.mockRejectedValue(new Error('db'));
 await expect(ctx.login({email:'a@b.ec',password:'pass',ip:'ip'})).rejects.toThrow('db');
 expect(ctx.finish).toHaveBeenCalledWith('error');
});
test('límite impide intentos simultáneos y expira',()=>{
 let now=0;const limiter=createLimiter({accountMax:1,ipMax:2,windowMs:100,lockMs:100},()=>now);
 const finish=limiter.begin('a','ip');expect(()=>limiter.begin('a','ip')).toThrow('TOO_MANY_ATTEMPTS');finish('failure');
 now=101;expect(()=>limiter.begin('a','ip')).not.toThrow();
});
test('límite por IP suma cuentas diferentes y reiniciar crea memoria vacía',()=>{
 const config={accountMax:5,ipMax:2,windowMs:100,lockMs:100};const limiter=createLimiter(config,()=>0);
 limiter.begin('a','ip')('failure');limiter.begin('b','ip')('failure');
 expect(()=>limiter.begin('c','ip')).toThrow('TOO_MANY_ATTEMPTS');
 expect(()=>createLimiter(config).begin('c','ip')).not.toThrow();
});
test('configuración rechaza secreto ausente y duración ambigua',()=>{
 expect(()=>readAuthConfig({})).toThrow();expect(()=>readAuthConfig({JWT_SECRET:'x'.repeat(32),JWT_EXPIRES_IN:'30'})).toThrow();
});
test('Argon2id usa parámetros aprobados y verifica espacios sin recortarlos',async()=>{
 const hasher=await createHasher();const hash=await hasher.hash('  contraseña extensa  ');
 expect(hash.split('$').slice(1,3)).toEqual(['argon2id','v=19']);
 const params=Object.fromEntries(hash.split('$')[3].split(',').map(value=>value.split('=')));
 expect(params).toEqual({m:'19456',t:'2',p:'1'});
 expect(Buffer.from(hash.split('$')[4],'base64')).toHaveLength(16);
 expect(Buffer.from(hash.split('$')[5],'base64')).toHaveLength(32);
 expect(HASH_OPTIONS.hashLength).toBe(32);
 await expect(hasher.verify(hash,'  contraseña extensa  ')).resolves.toBe(true);
 await expect(hasher.verify(hash,'contraseña extensa')).resolves.toBe(false);
});
test('JWT rechaza firma manipulada y expiración',()=>{
 let now=0;const tokens=createTokens({secret:'x'.repeat(32),ttlSeconds:1},()=>now);
 const issued=tokens.issue({id:randomUUID(),role:'CUSTOMER',cooperative_id:null},randomUUID());
 expect(tokens.verify(issued.token).exp).toBe(1);
 expect(()=>tokens.verify(issued.token+'x')).toThrow('UNAUTHENTICATED');
 now=2000;expect(()=>tokens.verify(issued.token)).toThrow('UNAUTHENTICATED');
});
