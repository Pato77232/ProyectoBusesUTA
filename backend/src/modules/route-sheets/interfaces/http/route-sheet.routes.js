const express = require('express');
const createRouteSheetController = require('./route-sheet.controller');
const configureTariffController = require('./configure-route-sheet-tariff.controller');
const createProgrammingController = require('./route-sheet-programming.controller');
const prepareRenewalController = require('./prepare-renewal.controller');
const getEditorController = require('./get-route-sheet-editor.controller');

function createRouter({ auth, ...useCases }) {
  const router = express.Router();
  const controller = createRouteSheetController(useCases);
  const programming = createProgrammingController({
    saveProgramming: useCases.saveProgrammingUseCase,
    getProgramming: useCases.getProgrammingUseCase,
    assertLegacyOperation: useCases.assertLegacyProgrammingOperation,
  });

  router.use(auth.authenticate);
  router.get(
    '/:id/editor',
    auth.authorize('COOPERATIVE_ADMIN'),
    getEditorController(useCases.getEditorUseCase),
  );
  router.post(
    '/:id/renewals',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    prepareRenewalController(useCases.prepareRenewalUseCase),
  );
  router.put(
    '/:id/programming',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    programming.save,
  );
  router.get('/:id/programming', auth.authorize('COOPERATIVE_ADMIN'), programming.get);
  router.put(
    '/:id/tariff',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    configureTariffController(useCases.configureTariffUseCase),
  );

  router.post('/', auth.authorize('COOPERATIVE_ADMIN'), auth.csrfProtection, controller.create);
  router.get('/', auth.authorize('COOPERATIVE_ADMIN'), controller.list);
  router.get('/by-date-group', auth.authorize('COOPERATIVE_ADMIN'), controller.getByDateGroup);
  router.get('/purchase-window', auth.authorize('COOPERATIVE_ADMIN'), controller.getPurchaseWindow);

  router.post(
    '/:id/assignments',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    programming.guardLegacy,
    controller.addAssignment,
  );
  router.delete(
    '/:id/assignments/:assignmentId',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    programming.guardLegacy,
    controller.removeAssignment,
  );
  router.post(
    '/:id/rest-days',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    programming.guardLegacy,
    controller.addRestDay,
  );
  router.delete(
    '/:id/rest-days/:restDayId',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    programming.guardLegacy,
    controller.removeRestDay,
  );

  router.post(
    '/:id/publish',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    controller.publish,
  );
  router.post(
    '/:id/generate-cycles',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    programming.guardLegacy,
    controller.generateCycles,
  );
  router.get('/:id/modification-logs', auth.authorize('COOPERATIVE_ADMIN'), controller.getLogs);

  return router;
}

module.exports = createRouter;
