const createAuthenticate=require('../../../src/modules/auth/application/authenticate.use-case');
const {authorize}=require('../../../src/modules/auth/interfaces/authenticate');
test('sesión con cooperativa alterada no autentica',async()=>{
 const tokens={verify:()=>({sid:'s',sub:'u',role:'CLERK',cooperative_id:'a'})};
 const repository={findSession:async()=>({id:'u',role:'CLERK',cooperative_id:'b',expires_at:new Date(Date.now()+10000),revoked_at:null})};
 await expect(createAuthenticate({tokens,repository})('token')).rejects.toMatchObject({code:'UNAUTHENTICATED'});
});
test('autorización rechaza otro rol y acepta el permitido',()=>{
 const res={status:jest.fn().mockReturnThis(),json:jest.fn()};const next=jest.fn();
 authorize('SYSTEM_ADMIN')({auth:{user:{role:'CUSTOMER'}}},res,next);
 expect(res.status).toHaveBeenCalledWith(403);expect(next).not.toHaveBeenCalled();
 authorize('SYSTEM_ADMIN')({auth:{user:{role:'SYSTEM_ADMIN'}}},res,next);expect(next).toHaveBeenCalledTimes(1);
});
