class CyclePeriod {
  constructor(weeks) {
    const value = Number(weeks);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('La longitud del ciclo debe ser un número entero positivo.');
    }
    this.weeks = value;
  }

  getDays() {
    return this.weeks * 7;
  }

  toValue() {
    return this.weeks;
  }
}

module.exports = CyclePeriod;
