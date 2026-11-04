const createRegister=require('../../../src/modules/auth/application/register-customer.use-case');
test('registro normaliza email, conserva espacios de contraseña y delega solo datos de cliente',async()=>{
 const repository={createCustomer:jest.fn().mockResolvedValue()};const hasher={hash:jest.fn().mockResolvedValue('digest')};
 await createRegister({repository,hasher})({email:' A@EXAMPLE.EC ',password:'  contraseña extensa  ',role:'SYSTEM_ADMIN'});
 expect(hasher.hash).toHaveBeenCalledWith('  contraseña extensa  ');
 expect(repository.createCustomer).toHaveBeenCalledWith({email:'a@example.ec',passwordHash:'digest'});
});
