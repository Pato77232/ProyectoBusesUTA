const getBookingAttempt = require('../../../src/modules/bookings/application/get-booking-attempt.use-case');
const key = '00000000-0000-4000-8000-000000000001';

function setup() {
  const buyerIdentity = { resolve: jest.fn().mockResolvedValue({ ownerId: 'cliente' }) };
  const repository = {
    findByCreationRequest: jest.fn().mockResolvedValue({ bookingId: 'guardada' }),
  };
  return { buyerIdentity, repository, execute: getBookingAttempt({ buyerIdentity, repository }) };
}
test('consulta exclusivamente por dueño verificado y referencia, sin recalcular', async () => {
  const { execute, buyerIdentity, repository } = setup();
  const context = { sid: 'sesión-verificada' };
  expect(await execute(key, context)).toEqual({ bookingId: 'guardada' });
  expect(buyerIdentity.resolve).toHaveBeenCalledWith(context);
  expect(repository.findByCreationRequest).toHaveBeenCalledWith({
    ownerId: 'cliente',
    requestKey: key,
  });
});
test.each([undefined, '', 'invalida'])('rechaza clave %j antes de proveedores', async (value) => {
  const { execute, buyerIdentity, repository } = setup();
  await expect(execute(value)).rejects.toMatchObject({ code: 'BOOKING_VALIDATION_ERROR' });
  expect(buyerIdentity.resolve).not.toHaveBeenCalled();
  expect(repository.findByCreationRequest).not.toHaveBeenCalled();
});
test('sesión rechazada no ejecuta consulta por referencia', async () => {
  const { execute, buyerIdentity, repository } = setup();
  const failure = new Error('sesión inválida');
  buyerIdentity.resolve.mockRejectedValue(failure);
  await expect(execute(key)).rejects.toBe(failure);
  expect(repository.findByCreationRequest).not.toHaveBeenCalled();
});
test('ausencia para el propietario actual devuelve un error indistinguible', async () => {
  const { execute, repository } = setup();
  repository.findByCreationRequest.mockResolvedValue(null);
  await expect(execute(key)).rejects.toMatchObject({ code: 'BOOKING_ATTEMPT_NOT_FOUND' });
});
test('no convierte fallo de lectura en ausencia definitiva', async () => {
  const { execute, repository } = setup();
  const failure = new Error('base no disponible');
  repository.findByCreationRequest.mockRejectedValue(failure);
  await expect(execute(key)).rejects.toBe(failure);
});
