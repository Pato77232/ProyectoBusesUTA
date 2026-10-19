const PgFrequencyRepository = require('./infrastructure/pg-frequency.repository');
const createFrequencyUseCase = require('./application/create-frequency.use-case');
const getFrequencyUseCase = require('./application/get-frequency.use-case');
const listFrequenciesUseCase = require('./application/list-frequencies.use-case');
const changeFrequencyStatusUseCase = require('./application/change-frequency-status.use-case');
const createRouter = require('./interfaces/frequency-router');

function createFrequenciesModule({ pool, auth }) {
  const repository = new PgFrequencyRepository(pool);
  return {
    router: createRouter({
      createFrequencyUseCase: createFrequencyUseCase({ repository }),
      getFrequencyUseCase: getFrequencyUseCase({ repository }),
      listFrequenciesUseCase: listFrequenciesUseCase({ repository }),
      changeFrequencyStatusUseCase: changeFrequencyStatusUseCase({ repository }),
      auth,
    }),
  };
}

module.exports = { createFrequenciesModule };
