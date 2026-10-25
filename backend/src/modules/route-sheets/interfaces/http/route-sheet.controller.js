const {
  validateCreateRouteSheet,
  validateAssignment,
  validateRestDay,
  validateGenerateCycles,
  validatePublish,
} = require('./route-sheet.schemas');

function createRouteSheetController({
  createRouteSheetUseCase,
  getRouteSheetByDateAndGroupUseCase,
  listRouteSheetsUseCase,
  addAssignmentToRouteSheetUseCase,
  removeAssignmentFromRouteSheetUseCase,
  addRestDayToRouteSheetUseCase,
  removeRestDayFromRouteSheetUseCase,
  publishRouteSheetUseCase,
  generateAutomaticCyclesUseCase,
  getRouteSheetModificationLogsUseCase,
  getRouteSheetPurchaseWindowUseCase,
}) {
  return {
    async create(req, res, next) {
      try {
        const validation = validateCreateRouteSheet(req.body);
        if (!validation.valid) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validation.message } });
        }
        const result = await createRouteSheetUseCase({
          cooperativeId: req.auth.user.cooperative_id,
          routeDate: req.body.routeDate,
          busGroupId: req.body.busGroupId,
          createdBy: req.auth.user.id,
          notes: req.body.notes,
        });
        return res.status(201).json({ routeSheet: result });
      } catch (error) {
        return next(error);
      }
    },

    async list(req, res, next) {
      try {
        const result = await listRouteSheetsUseCase({
          cooperativeId: req.auth.user.cooperative_id,
          busGroupId: req.query.busGroupId,
          fromDate: req.query.fromDate,
          toDate: req.query.toDate,
          status: req.query.status,
        });
        return res.status(200).json({ routeSheets: result });
      } catch (error) {
        return next(error);
      }
    },

    async getByDateGroup(req, res, next) {
      try {
        const result = await getRouteSheetByDateAndGroupUseCase({
          cooperativeId: req.auth.user.cooperative_id,
          busGroupId: req.query.busGroupId,
          routeDate: req.query.routeDate,
        });
        return res.status(200).json({ routeSheet: result });
      } catch (error) {
        return next(error);
      }
    },

    async addAssignment(req, res, next) {
      try {
        const validation = validateAssignment(req.body);
        if (!validation.valid) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validation.message } });
        }
        const result = await addAssignmentToRouteSheetUseCase({
          routeSheetId: req.params.id,
          cooperativeId: req.auth.user.cooperative_id,
          busId: req.body.busId,
          frequencyId: req.body.frequencyId,
          modifiedBy: req.auth.user.id,
          reason: req.body.reason,
          forceWithPassengersWarning: req.body.forceWithPassengersWarning,
        });
        return res.status(200).json({ routeSheet: result });
      } catch (error) {
        return next(error);
      }
    },

    async removeAssignment(req, res, next) {
      try {
        const result = await removeAssignmentFromRouteSheetUseCase({
          routeSheetId: req.params.id,
          cooperativeId: req.auth.user.cooperative_id,
          assignmentId: req.params.assignmentId,
          modifiedBy: req.auth.user.id,
          reason: req.body?.reason,
          forceWithPassengersWarning: req.body?.forceWithPassengersWarning,
        });
        return res.status(200).json({ routeSheet: result });
      } catch (error) {
        return next(error);
      }
    },

    async addRestDay(req, res, next) {
      try {
        const validation = validateRestDay(req.body);
        if (!validation.valid) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validation.message } });
        }
        const result = await addRestDayToRouteSheetUseCase({
          routeSheetId: req.params.id,
          cooperativeId: req.auth.user.cooperative_id,
          busId: req.body.busId,
          reason: req.body.reason,
          modifiedBy: req.auth.user.id,
          reasonForChange: req.body.reasonForChange,
          forceWithPassengersWarning: req.body.forceWithPassengersWarning,
        });
        return res.status(200).json({ routeSheet: result });
      } catch (error) {
        return next(error);
      }
    },

    async removeRestDay(req, res, next) {
      try {
        const result = await removeRestDayFromRouteSheetUseCase({
          routeSheetId: req.params.id,
          cooperativeId: req.auth.user.cooperative_id,
          restDayId: req.params.restDayId,
          modifiedBy: req.auth.user.id,
          reasonForChange: req.body?.reasonForChange,
          forceWithPassengersWarning: req.body?.forceWithPassengersWarning,
        });
        return res.status(200).json({ routeSheet: result });
      } catch (error) {
        return next(error);
      }
    },

    async publish(req, res, next) {
      try {
        const validation = validatePublish(req.body);
        if (!validation.valid) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validation.message } });
        }
        const result = await publishRouteSheetUseCase({
          routeSheetId: req.params.id,
          cooperativeId: req.auth.user.cooperative_id,
          publishedBy: req.auth.user.id,
        });
        return res.status(200).json({ routeSheet: result });
      } catch (error) {
        return next(error);
      }
    },

    async generateCycles(req, res, next) {
      try {
        const validation = validateGenerateCycles(req.body);
        if (!validation.valid) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validation.message } });
        }
        const result = await generateAutomaticCyclesUseCase({
          baseRouteSheetId: req.params.id,
          cooperativeId: req.auth.user.cooperative_id,
          generatedBy: req.auth.user.id,
          cycleLengthWeeks: req.body.cycleLengthWeeks,
        });
        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    async getLogs(req, res, next) {
      try {
        const result = await getRouteSheetModificationLogsUseCase({
          routeSheetId: req.params.id,
          cooperativeId: req.auth.user.cooperative_id,
        });
        return res.status(200).json({ logs: result });
      } catch (error) {
        return next(error);
      }
    },

    async getPurchaseWindow(req, res, next) {
      try {
        const result = await getRouteSheetPurchaseWindowUseCase({
          cooperativeId: req.auth.user.cooperative_id,
          busGroupId: req.query.busGroupId,
        });
        return res.status(200).json({ purchaseWindow: result });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = createRouteSheetController;
