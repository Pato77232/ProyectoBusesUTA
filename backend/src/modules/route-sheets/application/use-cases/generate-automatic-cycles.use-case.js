const RouteSheetCycle = require('../../domain/entities/route-sheet-cycle');
const RouteSheetCycleDTO = require('../dtos/route-sheet-cycle.dto');
const { CycleGenerationNotAllowedError, MaxAutomaticCyclesExceededError } = require('../../domain/errors/route-sheet-errors');

function generateAutomaticCyclesUseCase({
  routeSheetRepository,
  routeSheetAssignmentRepository,
  routeSheetRestDayRepository,
  routeSheetCycleRepository,
}) {
  return async ({ baseRouteSheetId, cooperativeId, generatedBy, cycleLengthWeeks = 2 }) => {
    const baseRouteSheet = routeSheetRepository.findBaseForCycles
      ? await routeSheetRepository.findBaseForCycles(baseRouteSheetId, cooperativeId)
      : await routeSheetRepository.findById(baseRouteSheetId, cooperativeId);

    if (!baseRouteSheet) {
      throw new CycleGenerationNotAllowedError();
    }

    if (!baseRouteSheet.isBase && baseRouteSheet.status && baseRouteSheet.status.toString && baseRouteSheet.status.toString() !== 'PUBLISHED') {
      throw new CycleGenerationNotAllowedError();
    }

    const existingCount = routeSheetCycleRepository.countByBaseRouteSheetId
      ? await routeSheetCycleRepository.countByBaseRouteSheetId(baseRouteSheetId, cooperativeId)
      : 0;
    if (existingCount >= 2) {
      throw new MaxAutomaticCyclesExceededError();
    }

    const assignments = await routeSheetAssignmentRepository.findByRouteSheetId(baseRouteSheetId, cooperativeId);
    const restDays = await routeSheetRestDayRepository.findByRouteSheetId(baseRouteSheetId, cooperativeId);

    const cyclesToGenerate = [];
    const baseDate = baseRouteSheet.routeDate instanceof Date ? baseRouteSheet.routeDate : new Date(baseRouteSheet.routeDate);

    for (let cycleNumber = existingCount + 1; cycleNumber <= 2; cycleNumber += 1) {
      const startDate = new Date(baseDate);
      startDate.setDate(startDate.getDate() + (cycleNumber - 1) * cycleLengthWeeks * 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + cycleLengthWeeks * 7 - 1);

      const cycle = new RouteSheetCycle({
        baseRouteSheetId,
        cooperativeId,
        busGroupId: baseRouteSheet.busGroupId,
        cycleNumber,
        startDate,
        endDate,
        status: 'DRAFT',
        generatedBy,
      });

      const savedCycle = routeSheetCycleRepository.save ? await routeSheetCycleRepository.save(cycle) : cycle;
      cyclesToGenerate.push(savedCycle);
    }

    if (routeSheetRepository.save && baseRouteSheet.isBase === false) {
      baseRouteSheet.isBase = true;
      baseRouteSheet.cycleLengthWeeks = cycleLengthWeeks;
      await routeSheetRepository.save(baseRouteSheet);
    }

    return {
      base: baseRouteSheet,
      cycles: cyclesToGenerate.map((cycle) => RouteSheetCycleDTO.fromEntity(cycle)),
      assignmentsCopied: assignments.length,
      restDaysCopied: restDays.length,
    };
  };
}

module.exports = generateAutomaticCyclesUseCase;
