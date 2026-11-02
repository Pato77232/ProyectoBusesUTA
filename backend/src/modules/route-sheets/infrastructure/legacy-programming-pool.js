const { RouteProgrammingConflictError } = require('../domain/errors/route-programming-errors');
const GUARDS = ['guard_route_programming_legacy_write', 'guard_route_programming_cycles'];

function legacyProgrammingPool(pool) {
  return {
    async query(...args) {
      try {
        return await pool.query(...args);
      } catch (error) {
        if (error.code === '23514' && GUARDS.some((name) => error.where?.includes(name)))
          throw new RouteProgrammingConflictError(
            'ROUTE_PROGRAMMING_LEGACY_OPERATION',
            'El bus o grupo requiere programación integral; usa el apartado de programación.',
          );
        throw error;
      }
    },
  };
}

module.exports = legacyProgrammingPool;
