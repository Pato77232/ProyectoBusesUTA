const express = require('express');
const createRouteSheetController = require('./route-sheet.controller');

function createRouter({ auth, ...useCases }) {
  const router = express.Router();
  const controller = createRouteSheetController(useCases);

  router.use(auth.authenticate);

  router.post('/', auth.authorize('COOPERATIVE_ADMIN'), auth.csrfProtection, controller.create);
  router.get('/', auth.authorize('COOPERATIVE_ADMIN'), controller.list);
  router.get('/by-date-group', auth.authorize('COOPERATIVE_ADMIN'), controller.getByDateGroup);
  router.get('/purchase-window', auth.authorize('COOPERATIVE_ADMIN'), controller.getPurchaseWindow);

  router.post('/:id/assignments', auth.authorize('COOPERATIVE_ADMIN'), auth.csrfProtection, controller.addAssignment);
  router.delete('/:id/assignments/:assignmentId', auth.authorize('COOPERATIVE_ADMIN'), auth.csrfProtection, controller.removeAssignment);
  router.post('/:id/rest-days', auth.authorize('COOPERATIVE_ADMIN'), auth.csrfProtection, controller.addRestDay);
  router.delete('/:id/rest-days/:restDayId', auth.authorize('COOPERATIVE_ADMIN'), auth.csrfProtection, controller.removeRestDay);

  router.post('/:id/publish', auth.authorize('COOPERATIVE_ADMIN'), auth.csrfProtection, controller.publish);
  router.post('/:id/generate-cycles', auth.authorize('COOPERATIVE_ADMIN'), auth.csrfProtection, controller.generateCycles);
  router.get('/:id/modification-logs', auth.authorize('COOPERATIVE_ADMIN'), controller.getLogs);

  return router;
}

module.exports = createRouter;
