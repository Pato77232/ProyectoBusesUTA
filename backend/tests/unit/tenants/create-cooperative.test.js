const {createCooperativeData}=require('../../../src/modules/tenants/domain/cooperative');
const createCooperative=require('../../../src/modules/tenants/application/create-cooperative.use-case');
const PgCooperativeRepository=require('../../../src/modules/tenants/infrastructure/pg-cooperative.repository');
const valid={name:'Cooperativa de prueba',ruc:'0012345678901'};
test('normaliza textos, conserva ceros de RUC y convierte opcionales vacíos en null',()=>{
 expect(createCooperativeData({name:' Bus UTA ',ruc:' 0012345678901 ',email:' TEST@EXAMPLE.EC ',phone:' ',address:null})).toEqual({name:'Bus UTA',ruc:'0012345678901',email:'test@example.ec',phone:null,address:null});
});
test.each([null,[],{}, {...valid,name:' '},{...valid,ruc:1234567890123},{...valid,ruc:'123'},{...valid,ruc:'123456789012x'},{...valid,email:'bad'},{...valid,phone:12},{...valid,id:'client-id'}])('rechaza datos inválidos: %j',(input)=>{
 expect(()=>createCooperativeData(input)).toThrow('VALIDATION_ERROR');
});
test('caso de uso persiste solo datos normalizados para SYSTEM_ADMIN',async()=>{
 const repository={create:jest.fn().mockResolvedValue({id:'generated'})};
 await expect(createCooperative({repository})(valid,{role:'SYSTEM_ADMIN'})).resolves.toEqual({id:'generated'});
 expect(repository.create).toHaveBeenCalledWith({...valid,email:null,phone:null,address:null});
});
test.each([undefined,{role:'CUSTOMER'},{role:'CLERK'},{role:'COOPERATIVE_ADMIN'}])('caso de uso rechaza actor no autorizado: %j',async(actor)=>{
 const repository={create:jest.fn()};
 await expect(createCooperative({repository})(valid,actor)).rejects.toMatchObject({code:'FORBIDDEN'});
 expect(repository.create).not.toHaveBeenCalled();
});
test('repositorio traduce solo duplicado de RUC y conserva otros errores',async()=>{
 const pool={query:jest.fn().mockRejectedValue({code:'23505',constraint:'cooperatives_ruc_unique'})};
 const repository=new PgCooperativeRepository(pool);
 await expect(repository.create(createCooperativeData(valid))).rejects.toMatchObject({code:'COOPERATIVE_ALREADY_EXISTS'});
 const failure=new Error('database unavailable');pool.query.mockRejectedValue(failure);
 await expect(repository.create(createCooperativeData(valid))).rejects.toBe(failure);
});
