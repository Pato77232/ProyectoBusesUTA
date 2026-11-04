class RouteDate {
  constructor(value) {
    if (!(value instanceof Date) && typeof value !== 'string') {
      throw new Error('Fecha de hoja de ruta inválida.');
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Fecha de hoja de ruta inválida.');
    }
    this.value = date;
  }

  toString() {
    return this.value.toISOString().split('T')[0];
  }

  toDate() {
    return new Date(this.value.getTime());
  }
}

module.exports = RouteDate;
