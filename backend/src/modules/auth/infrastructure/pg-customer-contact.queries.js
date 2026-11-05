const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lectura pública de Auth para avisos: correo de un CUSTOMER por su identificador.
 * Otro rol, un identificador que no es UUID o un usuario inexistente devuelven null.
 */
function createCustomerContactQueries({ pool } = {}) {
  if (typeof pool?.query !== 'function') throw new TypeError('Se requiere una conexión de Auth.');
  return Object.freeze({
    async findCustomerEmail(userId) {
      if (typeof userId !== 'string' || !UUID.test(userId)) return null;
      const { rows } = await pool.query(
        "SELECT email FROM users WHERE id = $1 AND role = 'CUSTOMER'",
        [userId],
      );
      return rows.length === 1 ? rows[0].email : null;
    },
  });
}

module.exports = createCustomerContactQueries;
