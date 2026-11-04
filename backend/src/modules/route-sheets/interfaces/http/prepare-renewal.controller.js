const { RenewalValidationError } = require('../../domain/errors/route-renewal-errors');

module.exports = (prepareRenewal) => async (req, res, next) => {
  try {
    if (
      !req.is('application/json') ||
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body) ||
      Object.keys(req.body).some(
        (key) =>
          !['expectedProgrammingRevision', 'expectedTariffRevision', 'requestKey'].includes(key),
      )
    )
      throw new RenewalValidationError();
    const result = await prepareRenewal(
      { ...req.body, sourceRouteSheetId: req.params.id },
      req.auth.user,
    );
    res.set('Cache-Control', 'no-store');
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    return next(error);
  }
};
