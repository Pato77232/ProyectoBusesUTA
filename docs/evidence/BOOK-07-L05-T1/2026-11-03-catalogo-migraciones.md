# BOOK-07-L05-T1: catálogo y actualización segura de Reservas

Fecha: 3 de noviembre de 2026 (America/Guayaquil). Rama original feature/BOOK-03-resumen-creacion-dominio; HEAD inicial publicado 901d308; PR #51 en borrador. Develop contrastado mediante fetch en 2df5949: mismas 17 migraciones, máximo 1793730000000. No se incorpora incidentalmente el código posterior de Auth ni se afirma haber probado esa combinación. Implementación autorizada expresamente por Leslie; revisión humana pendiente.

## Cambio

- Los tres originales de Reservas permanecen íntegros en backend/migrations, con sus mismos nombres. El catálogo activo los excluye de la ejecución automática, conservándolos como fuente de SQL y evidencia histórica.
- 1793820000000-install-bookings aplica sus tres operaciones up en orden bajo una sola entrada real del historial; down usa sus inversas. No duplica SQL ni falsifica los tres identificadores anteriores.
- scripts/migration-catalog.js enumera las 17 migraciones conocidas de develop más la nueva; exige coincidencia de archivos activos y conserva la exclusión de ocultos. Un archivo visible desconocido exige actualizar explícitamente el catálogo, no se adopta automáticamente.
- scripts/migration-history.js valida estructura del historial y prefijo ordenado; rechaza originales de Reservas, entradas desconocidas, duplicadas, omitidas o desordenadas, esquema sin historial e instalación de Reservas sin su entrada activa. No consulta ni convierte bases persistentes.
- scripts/migrate.js adquiere el mismo advisory lock de node-pg-migrate antes de leer el historial y mantiene checkOrder:true y bloqueo del runner. El bloqueo exterior permanece hasta cerrar la conexión; el nivel recursivo de la biblioteca usa la misma sesión.
- Una transacción exterior incluye también la creación inicial de pgmigrations. El cliente delegado transforma únicamente BEGIN/COMMIT/ROLLBACK del lote del runner en savepoints; SQL y parámetros restantes se delegan intactos. La biblioteca es la única que registra las migraciones después de aplicar su esquema. No fake, no INSERT/UPDATE/DELETE manuales de historial, no checkOrder:false.

## Pruebas y entorno

PostgreSQL 16.13 en Compose exclusivo busesuta-leslie-migraciones, puerto local 55433, sin .env ni datos reales. Base inicial busesuta_test vacía comprobada antes de ejecutar. Cada nuevo escenario crea además su propia base catalog_<UUID>_test, la elimina al terminar y usa datos ficticios.

Los escenarios del catálogo se ejecutan con Node real mediante tests/helpers/migration-worker.js. El primer intento dentro del VM de Jest falló por la importación ESM de node-pg-migrate; se corrigió el harness sin cambiar expectativas ni configuración de Jest.

### Evidencia dirigida inicial

16 unitarias aprobadas. 11 integraciones aprobadas: instalación vacía y reintento sin duplicados; down/up del catálogo activo; copia de las 17 migraciones de develop con usuarios, sesión, cooperativas, grupos, bus/fotos/asientos, frecuencia/parada/precios, hoja y comprobante; conservación de cada fila y definición previa; originales aplicados mediante runner real (uno, dos y tres), rechazados tanto en up como down; hueco real y nombre desconocido; esquema sin historial e instalación sin registro; fallo de DDL con base vacía y con base de develop; bloqueo entre conexiones reales.

El fallo se inyecta mediante event trigger de QA al crear la protección de recepción, después de los pasos anteriores del esquema de Reservas. El snapshot de tablas, filas, columnas, restricciones, índices y funciones queda idéntico. En la base inicialmente vacía tampoco queda pgmigrations creado. Al retirar el fallo, la misma base puede migrar normalmente.

La reversión se refiere a estado transaccional de esquema/filas/historial; PostgreSQL no garantiza continuidad sin huecos de secuencias. No se utiliza esa continuidad como identidad de negocio.

### Suites finales

- Lint aprobado; formato explícito de los diez archivos JS del incremento aprobado. Formato global conserva 17 archivos ajenos pendientes.
- Primera suite completa: 1588 unitarias aprobadas; integración 123 aprobadas/350 fallidas. Se detectó que la validación de esquema vacío clasificaba pgmigrations_pkey como objeto desconocido después de down completo. Los fallos posteriores eran consecuencia de ese rechazo, además del timeout conocido de fotografía.
- Corrección: al comprobar tablas sin historial, los índices se consideran a través de su relación propietaria; la tabla desconocida sigue rechazándose. Se añade regresión específica de historial legítimo vacío con índice interno. Repetición dirigida de catálogo, reversión global, idempotencia y persistencia: 50/50 aprobadas; catálogo ahora cubre 12 integraciones.
- Repetición global final: 1588/1588 unitarias (81 suites) y 474/474 integraciones (35 suites), 2062 pruebas aprobadas; npm test salida 0. Incluye arranque real en booking-http.test.js. La prueba de fotografías pasó en esta repetición sin cambios ni aumento de su límite de 20000 ms; se conserva el timeout del intento anterior como incidencia reproducida, no se declara eliminado definitivamente.
- Última revisión: la detección de Reservas utiliza el nombre estable 1793820000000-install-bookings, sin depender de cuál sea la última migración futura del catálogo. Limpieza de fixture de archivos valida su ruta absoluta antes de borrar. Comprobaciones dirigidas finales: 28/28 (16 unitarias + 12 integraciones), salida 0; lint repetido aprobado y formato de los diez JS del incremento aprobado.

## Pruebas históricas conservadas

La prueba global enumera ahora entradas activas y sigue revirtiendo/reaplicando todo el catálogo sin duplicados. La reversión de instalación apunta a la nueva entrada que realmente crea las tablas. El caso de idempotencia ejecuta up/down del original directamente como fixture histórica en PostgreSQL aislado; mantiene las expectativas de conservación de reserva/asientos, eliminación y recreación de metadatos, y añade que el historial activo queda intacto. Los casos históricos UNKNOWN y down incompatible de payment-read.test.js se conservan sin modificar.

No se cambia el timeout ni la prueba de fotografías. No hay cambios de negocio, HTTP, frontend, dependencias o composición de módulos. El arranque real existente forma parte de la suite HTTP de Reservas.

## Uso y límites

Los comandos siguen siendo npm run migrate y npm run migrate:down desde backend, con la conexión proporcionada por el entorno autorizado. No utilizar exclusiones personalizadas ni escribir historial a mano para eludir un rechazo.

Si aparece MIGRATION_HISTORY_UNSUPPORTED, detenerse: esa base tiene originales de Reservas en su historial y necesita un plan específico con copia de seguridad, conciliación del esquema y revisión humana. Esta implementación no certifica que ninguna base persistente los tenga: ninguna se inspeccionó. Un rechazo conserva los datos y no autoriza borrarlos para empezar de cero.

La migración nueva instala únicamente lo que ya contenía la rama de Reservas. No implementa recepción, expiración, confirmación de venta ni liberación, y no conecta rutas productivas de Payments. El alcance de PR #51 no se presenta como compra comercial completa.

## Publicación y revisión

Diff completo revisado; originales comparados con 901d308 sin cambios y las 17 migraciones comunes comparadas con origin/develop sin diferencias. Commit/publicación autorizados únicamente en la rama feature de PR #51. Su commit resultante se consulta en el historial; no merge hacia develop, no cambio a main/develop ni tags. PR conserva su estado de borrador y revisión humana pendiente. La descripción actualizada se prepara en descripcion-pr.md junto a esta evidencia; cualquier limitación del conector se informa sin atribuir una actualización remota no comprobada.

Limpieza confirmada: bases catalog_<UUID>_test retiradas por sus fixtures; contenedor y red busesuta-leslie-migraciones eliminados al terminar. Sin recursos propios restantes ni cambios a los demás servicios Docker.
