const { ProgrammingSourceError } = require('../../domain/errors/programming-persistence-errors');
const { RouteProgrammingValidationError } = require('../../domain/errors/route-programming-errors');

function report(next, error) {
  next(error.httpStatus ? error : new ProgrammingSourceError());
}

function createProgrammingController({ saveProgramming, getProgramming, assertLegacyOperation }) {
  const context = (req) => ({
    routeSheetId: req.params.id,
    cooperativeId: req.auth.user.cooperative_id,
  });
  return {
    async save(req, res, next) {
      try {
        const body = req.body;
        if (
          !body ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          Object.keys(body).some((key) => !['expectedRevision', 'programming'].includes(key))
        )
          throw new RouteProgrammingValidationError(
            'Solo se permiten expectedRevision y programming.',
          );
        res.status(200).json(
          await saveProgramming({
            ...context(req),
            modifiedBy: req.auth.user.id,
            expectedRevision: body.expectedRevision,
            programming: body.programming,
          }),
        );
      } catch (error) {
        report(next, error);
      }
    },
    async get(req, res, next) {
      try {
        res.status(200).json(await getProgramming(context(req)));
      } catch (error) {
        report(next, error);
      }
    },
    async guardLegacy(req, _res, next) {
      try {
        await assertLegacyOperation(context(req));
        next();
      } catch (error) {
        report(next, error);
      }
    },
  };
}

module.exports = createProgrammingController;
