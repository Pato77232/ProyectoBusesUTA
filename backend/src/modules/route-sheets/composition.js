const createRouter = require('./interfaces/http/route-sheet.routes');

function createRouteSheetsModule({ auth }) {
  return {
    router: createRouter({ auth }),
  };
}

module.exports = createRouteSheetsModule;
