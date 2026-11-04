const {
  RouteSheetAlreadyExistsForDateAndGroupError,
  RouteSheetNotFoundError,
  RouteSheetNotEditableError,
  FrequencyNotActiveError,
  FrequencyNotFromCooperativeError,
  BusNotFromCooperativeError,
  BusGroupNotFromCooperativeError,
  BusAlreadyAssignedError,
  BusAssignmentConflictWithPassengersError,
  TooManyBusesForFrequenciesError,
  InvalidRestDayAssignmentError,
  MissingBusGroupForRouteSheetError,
  CycleGenerationNotAllowedError,
  MaxAutomaticCyclesExceededError,
  RouteSheetCycleConflictError,
} = require('../../../../src/modules/route-sheets/domain/errors/route-sheet-errors');
const DomainError = require('../../../../src/modules/route-sheets/domain/errors/domain-error');

describe('Errores de dominio de route-sheets', () => {
  test('RouteSheetAlreadyExistsForDateAndGroupError extiende DomainError', () => {
    const error = new RouteSheetAlreadyExistsForDateAndGroupError();
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('ROUTE_SHEET_ALREADY_EXISTS_FOR_DATE_AND_GROUP');
    expect(error.httpStatus).toBe(409);
  });

  test('RouteSheetNotFoundError tiene código correcto', () => {
    const error = new RouteSheetNotFoundError();
    expect(error.code).toBe('ROUTE_SHEET_NOT_FOUND');
    expect(error.httpStatus).toBe(404);
  });

  test('RouteSheetNotEditableError tiene código correcto', () => {
    const error = new RouteSheetNotEditableError();
    expect(error.code).toBe('ROUTE_SHEET_NOT_EDITABLE');
    expect(error.httpStatus).toBe(403);
  });

  test('FrequencyNotActiveError tiene código correcto', () => {
    const error = new FrequencyNotActiveError();
    expect(error.code).toBe('FREQUENCY_NOT_ACTIVE');
    expect(error.httpStatus).toBe(400);
  });

  test('FrequencyNotFromCooperativeError tiene código correcto', () => {
    const error = new FrequencyNotFromCooperativeError();
    expect(error.code).toBe('FREQUENCY_NOT_FROM_COOPERATIVE');
    expect(error.httpStatus).toBe(403);
  });

  test('BusNotFromCooperativeError tiene código correcto', () => {
    const error = new BusNotFromCooperativeError();
    expect(error.code).toBe('BUS_NOT_FROM_COOPERATIVE');
    expect(error.httpStatus).toBe(403);
  });

  test('BusGroupNotFromCooperativeError tiene código correcto', () => {
    const error = new BusGroupNotFromCooperativeError();
    expect(error.code).toBe('BUS_GROUP_NOT_FROM_COOPERATIVE');
    expect(error.httpStatus).toBe(403);
  });

  test('BusAlreadyAssignedError tiene código correcto', () => {
    const error = new BusAlreadyAssignedError();
    expect(error.code).toBe('BUS_ALREADY_ASSIGNED');
    expect(error.httpStatus).toBe(409);
  });

  test('BusAssignmentConflictWithPassengersError tiene código correcto', () => {
    const error = new BusAssignmentConflictWithPassengersError();
    expect(error.code).toBe('BUS_ASSIGNMENT_CONFLICT_WITH_PASSENGERS');
    expect(error.httpStatus).toBe(409);
  });

  test('TooManyBusesForFrequenciesError tiene código correcto', () => {
    const error = new TooManyBusesForFrequenciesError();
    expect(error.code).toBe('TOO_MANY_BUSES_FOR_FREQUENCIES');
    expect(error.httpStatus).toBe(400);
  });

  test('InvalidRestDayAssignmentError tiene código correcto', () => {
    const error = new InvalidRestDayAssignmentError();
    expect(error.code).toBe('INVALID_REST_DAY_ASSIGNMENT');
    expect(error.httpStatus).toBe(400);
  });

  test('MissingBusGroupForRouteSheetError tiene código correcto', () => {
    const error = new MissingBusGroupForRouteSheetError();
    expect(error.code).toBe('MISSING_BUS_GROUP_FOR_ROUTE_SHEET');
    expect(error.httpStatus).toBe(400);
  });

  test('CycleGenerationNotAllowedError tiene código correcto', () => {
    const error = new CycleGenerationNotAllowedError();
    expect(error.code).toBe('CYCLE_GENERATION_NOT_ALLOWED');
    expect(error.httpStatus).toBe(400);
  });

  test('MaxAutomaticCyclesExceededError tiene código correcto', () => {
    const error = new MaxAutomaticCyclesExceededError();
    expect(error.code).toBe('MAX_AUTOMATIC_CYCLES_EXCEEDED');
    expect(error.httpStatus).toBe(400);
  });

  test('RouteSheetCycleConflictError tiene código correcto', () => {
    const error = new RouteSheetCycleConflictError();
    expect(error.code).toBe('ROUTE_SHEET_CYCLE_CONFLICT');
    expect(error.httpStatus).toBe(409);
  });
});
