function validateCreateRouteSheet(body) {
  if (!body.cooperativeId && !body.busGroupId && !body.routeDate) {
    return { valid: false, message: 'Datos incompletos.' };
  }
  return { valid: true };
}

function validateAssignment(body) {
  if (!body.busId || !body.frequencyId) {
    return { valid: false, message: 'busId y frequencyId son obligatorios.' };
  }
  return { valid: true };
}

function validateRestDay(body) {
  if (!body.busId) {
    return { valid: false, message: 'busId es obligatorio.' };
  }
  return { valid: true };
}

function validateGenerateCycles(body) {
  return { valid: true };
}

function validatePublish(body) {
  if (
    body !== undefined &&
    (!body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) => !['expectedRevision', 'expectedProgrammingRevision'].includes(key),
      ))
  )
    return { valid: false, message: 'Solo se permiten las revisiones de tarifa y programación.' };
  return { valid: true };
}

module.exports = {
  validateCreateRouteSheet,
  validateAssignment,
  validateRestDay,
  validateGenerateCycles,
  validatePublish,
};
