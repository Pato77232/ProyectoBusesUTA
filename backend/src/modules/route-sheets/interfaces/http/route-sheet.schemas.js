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
  return { valid: true };
}

module.exports = {
  validateCreateRouteSheet,
  validateAssignment,
  validateRestDay,
  validateGenerateCycles,
  validatePublish,
};
