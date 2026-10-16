const createLogout=require('../../../src/modules/auth/application/logout.use-case');
test('logout revoca el sid y usuario autenticados',async()=>{
 const repository={revokeSession:jest.fn().mockResolvedValue()};
 await createLogout({repository})({sid:'session-current',user:{id:'user-current'}});
 expect(repository.revokeSession).toHaveBeenCalledWith('session-current','user-current');
});
