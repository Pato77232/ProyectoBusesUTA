class BookingAccessError extends Error {
  constructor(code = 'UNAUTHENTICATED') {
    super(code === 'FORBIDDEN' ? 'Acceso no permitido.' : 'Sesión inválida o vencida.');
    this.name = 'BookingAccessError';
    this.code = code;
  }
}
module.exports = BookingAccessError;
