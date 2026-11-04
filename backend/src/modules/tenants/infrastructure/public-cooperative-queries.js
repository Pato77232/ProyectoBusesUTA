const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
module.exports = ({ pool }) =>
  Object.freeze({
    async findByIds(ids) {
      if (
        !Array.isArray(ids) ||
        ids.length > 100 ||
        ids.some((id) => typeof id !== 'string' || !UUID.test(id))
      )
        throw new TypeError('Identificadores de cooperativas inválidos.');
      if (!ids.length) return [];
      const { rows } = await pool.query(
        'SELECT id,name FROM cooperatives WHERE id=ANY($1::uuid[])',
        [ids],
      );
      return rows;
    },
  });
