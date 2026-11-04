class BusGroupError extends Error {
  constructor(code) {
    super(code);
    this.name = 'BusGroupError';
    this.code = code;
  }
}

module.exports = BusGroupError;
