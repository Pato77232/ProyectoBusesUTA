const createCsrf=require('../../../src/modules/auth/interfaces/csrf');
const {readCookie}=require('../../../src/modules/auth/interfaces/cookies');
test('CSRF firmado expira y no se reutiliza en otra sesión',()=>{
 let now=0;let sid='one';const tokens={verify:()=>({sid})};
 const csrf=createCsrf('test-secret',tokens,()=>now);const cookies=new Map();let token;
 const response={cookie:(k,v)=>cookies.set(k,v),set:()=>response,json:value=>{token=value.csrfToken;}};
 csrf.issue({headers:{},secure:false},response);
 const request={headers:{cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')},get:()=>token};
 const res={status:jest.fn().mockReturnThis(),json:jest.fn()};const next=jest.fn();
 csrf.protect(request,res,next);expect(next).toHaveBeenCalledTimes(1);
 sid='two';csrf.protect(request,res,next);expect(res.status).toHaveBeenCalledWith(403);expect(next).toHaveBeenCalledTimes(1);
 sid='one';now=601000;csrf.protect(request,res,next);expect(next).toHaveBeenCalledTimes(1);
});
test('cookie duplicada o mal codificada no se acepta',()=>{
 expect(readCookie({headers:{cookie:'access_token=a; access_token=b'}},'access_token')).toBeUndefined();
 expect(readCookie({headers:{cookie:'access_token=%ZZ'}},'access_token')).toBeUndefined();
});
