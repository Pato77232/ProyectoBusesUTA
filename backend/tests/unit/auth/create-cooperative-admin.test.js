const createAdmin=require('../../../src/modules/auth/application/create-cooperative-admin.use-case');
test('normaliza email, usa hash y solo devuelve identidad pública',async()=>{
 const hasher={hash:jest.fn().mockResolvedValue('hash')};
 const repository={createCooperativeAdmin:jest.fn().mockResolvedValue({id:'u',email:'a@example.ec',role:'COOPERATIVE_ADMIN',cooperative_id:'c',password_hash:'hash'})};
 const result=await createAdmin({repository,hasher})({cooperativeId:'c',email:' A@EXAMPLE.EC ',password:' contraseña con espacios '});
 expect(hasher.hash).toHaveBeenCalledWith(' contraseña con espacios ');
 expect(repository.createCooperativeAdmin).toHaveBeenCalledWith({cooperativeId:'c',email:'a@example.ec',passwordHash:'hash'});
 expect(result).toEqual({id:'u',email:'a@example.ec',role:'COOPERATIVE_ADMIN',cooperative_id:'c'});
});
test('un fallo de hash no escribe en el repositorio',async()=>{
 const repository={createCooperativeAdmin:jest.fn()};const error=new Error('hash');
 await expect(createAdmin({repository,hasher:{hash:jest.fn().mockRejectedValue(error)}})({email:'a@example.ec',password:'p',cooperativeId:'c'})).rejects.toBe(error);
 expect(repository.createCooperativeAdmin).not.toHaveBeenCalled();
});
