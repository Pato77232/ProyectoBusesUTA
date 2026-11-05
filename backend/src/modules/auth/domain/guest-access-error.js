class GuestAccessError extends Error {
  constructor() {
    super('El acceso de invitado no es válido.');
    this.name = 'GuestAccessError';
    this.code = 'GUEST_ACCESS_INVALID';
    this.httpStatus = 404;
  }
}

module.exports = GuestAccessError;
