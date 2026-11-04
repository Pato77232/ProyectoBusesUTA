const VALID_STATUSES = ['DRAFT', 'PUBLISHED'];

class RouteSheetStatus {
  constructor(value) {
    if (!VALID_STATUSES.includes(value)) {
      throw new Error('Estado de hoja de ruta inválido.');
    }
    this.value = value;
  }

  static draft() {
    return new RouteSheetStatus('DRAFT');
  }

  static published() {
    return new RouteSheetStatus('PUBLISHED');
  }

  isDraft() {
    return this.value === 'DRAFT';
  }

  isPublished() {
    return this.value === 'PUBLISHED';
  }

  toString() {
    return this.value;
  }
}

module.exports = RouteSheetStatus;
