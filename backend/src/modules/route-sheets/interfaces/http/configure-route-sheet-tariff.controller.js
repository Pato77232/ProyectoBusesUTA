function configureTariffController(configureTariff) {
  return async (req, res, next) => {
    try {
      const tariff = await configureTariff({
        routeSheetId: req.params.id,
        cooperativeId: req.auth.user.cooperative_id,
        modifiedBy: req.auth.user.id,
        body: req.body,
      });
      res.status(200).json({ tariff });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = configureTariffController;
