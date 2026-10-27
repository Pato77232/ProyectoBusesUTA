class AntResolution {
  constructor(value) {
    if (!value || typeof value !== 'string' || value.trim() === '') {
      throw new Error('La resolución ANT es obligatoria.');
    }
    this.value = value.trim();
  }

  toString() {
    return this.value;
  }
}

module.exports = AntResolution;
