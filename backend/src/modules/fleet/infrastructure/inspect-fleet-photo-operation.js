const LocalBusPhotoStorage = require('./local-bus-photo-storage');

/** Diagnóstico de soporte en solo lectura; no autoriza eliminar un alta activa. */
async function inspectFleetPhotoOperation({ pool, root, busId, operationId, cooperativeId }) {
  const storage = new LocalBusPhotoStorage({ root });
  const directories = await storage.inspectOperation({ busId, operationId });
  const { rows } = await pool.query(
    `SELECT b.id, COALESCE(jsonb_agg(p.storage_key) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb) AS keys
    FROM buses b LEFT JOIN bus_photos p ON p.bus_id=b.id AND p.cooperative_id=b.cooperative_id
    WHERE b.id=$1 AND b.cooperative_id=$2 GROUP BY b.id`,
    [busId, cooperativeId],
  );
  const keys = rows[0]?.keys || [];
  const promoted = directories.find((entry) => entry.state === 'promoted');
  const matches = Boolean(
    rows[0] &&
    promoted &&
    !promoted.incomplete &&
    keys.length > 0 &&
    keys.length === promoted.files.length &&
    promoted.files.every((file) => file.complete && keys.includes(file.fileKey)),
  );
  return {
    busId,
    operationId,
    busExists: rows.length === 1,
    referencedPhotos: keys.length,
    directories,
    matches,
    // Ausencia en este tenant no acredita que no exista en otro: el operador debe comprobar contexto.
    action: matches ? 'PRESERVE' : 'MANUAL_REVIEW',
  };
}

module.exports = inspectFleetPhotoOperation;
