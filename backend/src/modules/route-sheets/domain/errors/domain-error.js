class DomainError extends Error {
  constructor(message, code, httpStatus) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

module.exports = DomainError;
