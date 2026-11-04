const { ProgrammingSourceError } = require('../../domain/errors/programming-persistence-errors');
module.exports = function getEditorController(getEditor) {
  return async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json(
        await getEditor({
          routeSheetId: req.params.id,
          cooperativeId: req.auth.user.cooperative_id,
        }),
      );
    } catch (error) {
      next(error.httpStatus ? error : new ProgrammingSourceError());
    }
  };
};
