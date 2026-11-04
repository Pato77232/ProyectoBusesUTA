class CooperativeError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CooperativeError';
    this.code = code;
  }
}
module.exports = CooperativeError;
