# BOOK-07: persistencia atómica de venta y coherencia de ciclo de vida

4 de noviembre de 2026, America/Guayaquil. Rama feature/BOOK-07-confirmacion-venta. Leslie comparte confirmación de Shirley sobre históricos y solicita ejecutar el siguiente paso. Asistencia de Codex en diseño, código, pruebas y documentación; no sustituye revisión humana.

## Base y acuerdos

HEAD de código ae88e0c; fetch encontró origin/develop da9c678 con cambios únicamente documentales de versionado. Se contrastó el diff y se conciliaron las cuatro actualizaciones documentales de Shirley con la preparación local, sin merge/rebase/checkout de main/develop. El catálogo remoto conserva 24 migraciones y no existe código nuevo de venta. Cotización 32afe9d sigue en su propia rama.

Shirley confirma conservar archivos/datos/decisiones previos, sin asignar versiones automáticas ni llamar al confirmador nuevo antes de conciliación; mantener bloqueo con intención pendiente/incierta y comprobar si ya hubo venta, sin liberar/rechazar automáticamente. BOOK-07 §16 registra el alcance autorizado de persistencia interna. No se atribuye a Shirley revisión de esta implementación ni disponibilidad de su proveedor.

## Cambio

Migración nueva 1794240000000-booking-sale-confirmations, añadida al final del catálogo como entrada 25, sin modificar ningún original. Agrega columnas nullable de versión/actor/fecha/confirmación en bookings; no rellena filas existentes. Estado CONFIRMED exige recepción conocida y datos coherentes; venta confirmada queda protegida contra updates. Down rechaza ventas existentes y revierte sin datos confirmados. No nuevas tablas ni escrituras en pgmigrations a mano.

PgBookingLifecycleRepository.confirmSale es método interno, no API pública de módulo. Copia/valida intento, usa misma clave de comprobante que recepción, bloquea viaje/reserva/asientos y verifica recepción ACCEPTED persistida, vínculos, resumen/total USD y conjunto exacto de ocupaciones. Actualiza todos los asientos a SOLD/active y la reserva/resultado dentro de una transacción. Reintento conserva fecha/actor/versión/total; COMMIT perdido es error incierto recuperable, no compensación.

Ciclo de vida y lectura reconocen CONFIRMED; expiración devuelve protección existente por comprobante recibido y el planificador excluye estas reservas. El lector de Payments admite CONFIRMED únicamente sin permitir cargas, conservando total y privacidad; no se modifica su confirmador simulado, intención/versionado o rutas de aprobación. No cambia composición ni API HTTP.

Las pruebas del catálogo ajustan conteos, bajan primero la ampliación nueva antes de probar rollbacks históricos y mantienen las comparaciones completas de filas/definiciones. Los únicos CHECK reemplazados se comparan con sus definiciones nuevas exactas, no patrones generales. Se añade actualización desde las 24 migraciones anteriores con reserva UNKNOWN y asiento, campos nuevos null y down que restaura snapshot completo.

## Pruebas dirigidas y correcciones

Primera ejecución dirigida: 37/39 aprobadas; dos fallos de preparación de pruebas nuevas (nombre de método de inventario incorrecto y conversión de conocido a UNKNOWN que el trigger prohíbe). Se corrigieron fixtures: lectura por listEffectiveByTrip y creación de fila histórica UNKNOWN desde su estado inicial, sin quitar trigger ni alterar producción para permitir conversión.

Segunda ejecución: 62/63 aprobadas, suites de venta y recepción/expiración aprobadas; único fallo en prueba nueva de conservación por comparar textos JSON que diferían en espacios del JSONB anidado. Se corrige a comparación profunda de todos los valores tras comprobar null de cada columna nueva; no se eliminan campos ni se relajan las comparaciones completas de rollback. Lint corrigió comparación no estricta del campo opcional confirmedAt y después pasó.

Suite de venta incluye: dos compradores/intentos de aprobación concurrentes con barreras pg_blocking_pids reales, dos órdenes con expiración, recuperación tras COMMIT real y respuesta perdida, rollback después de primer asiento y después del UPDATE de reserva, rechazo de identidad/versión/actor diferentes, no recepción/UNKNOWN/EXPIRED, conjuntos adulterados, protección de confirmada, lectura sin carga, recepción repetida y down seguro. Son intenciones/fuentes QA internas, no integración productiva con aprobación de Payments.

## Verificación final pendiente

npm test completo en ejecución tras correcciones, Node 24.21.0 y PostgreSQL 16.13 tmpfs exclusivo leslie-book07-venta, puerto 55433, NODE_ENV=test/base busesuta_test; --env-file NUL. No .env/secretos ni bases persistentes. Lint aprobado; format:check global mantiene 17 archivos ajenos. Registrar resultado real y limpieza al finalizar; no cambiar timeout de fotografías ni repetir buscando verde.

No dependencias ni frontend. No commit/push, publicación o integración. confirmSale pública sigue pendiente de caso de uso/fábrica y proveedor real de intención de Payments; esta entrega solo completa persistencia interna y consumidores del estado confirmado. El importe observado/moneda/actor del documento sigue bajo el contrato de revisión de Payments; Bookings no verifica transferencias bancarias.

## Primera ejecución global y ajustes de compatibilidad

Unitarias 1904/1904 aprobadas; integración 606/608 aprobadas, dos fallos en 48 suites, salida 1 (369,338 s). Fotografías pasó con timeout original. Se conservan resultados reales, no se atribuye verde a esta ejecución.

1. Renovación esperaba que su migración fuera la última: se adapta su test de down con rollbackBefore apuntando a 1794160000000-route-sheet-renewals y restauración de catálogo en finally. Conserva rechazo de down y protección de la fila, sin cambios al código de Route Sheets.
2. El harness de lectura histórica instala solo el esquema anterior de Reservas y exige clasificar UNKNOWN como integridad. SELECT directo de confirmed_at inexistente devolvía error SQL/INTERNAL_ERROR. Se lee la columna opcional mediante to_jsonb de la fila y cast timestamptz: un esquema anterior no inventa confirmación, UNKNOWN sigue rechazado por el dominio, y CONFIRMED requiere fecha válida. Se conserva la prueba antigua sin relajar su código esperado.

Se repite npm test por estos ajustes, no para ocultar un timeout de fotografías. No se cambian expectativas de negocio ni tiempos límite. Los demás cambios de validación/migración se mantienen.

Consulta posterior de PR abiertas: #72, auditoría ROUTE-SHEETS-09, sin operación de venta en su descripción. No se atribuye implementación de confirmSale a esa PR ni se revisa su código como parte de este incremento.

## Resultado final de verificación

Después de los dos ajustes, npm test terminó con salida 0: 1904/1904 unitarias en 97 suites (10,782 s), 608/608 integraciones en 48 suites (370,388 s), total 2512 pruebas en 145 suites. Incluye migración nueva, actualización desde catálogo 24 y conservación de filas, rollback con venta protegido, carreras reales, resultado perdido tras COMMIT y coherencia de lectura/expiración/recepción. Incluye pruebas existentes de arranque real, sin cambios de composición. Fotografías pasó sin modificar su timeout/código; no se declara corregido su antecedente intermitente.

Lint aprobado; formato propio aprobado en 16 JS. format:check global conserva los mismos 17 archivos ajenos, sin arreglos incidentales. El contenedor y red exclusivos leslie-book07-venta se eliminaron con compose down al terminar. Ninguna migración original modificada, ninguna base persistente inspeccionada o actualizada, ningún dato histórico versionado automáticamente.

Diff, alcance y enlaces locales revisados, git diff --check sin errores. Sin dependencias nuevas, frontend, commit, push o integración. Estado final: persistencia interna de venta completa/verificada localmente y revisión humana pendiente; aún falta el caso de uso/API pública de confirmación y su proveedor real de intención en Payments. No puede anunciarse a Shirley como confirmSale productiva disponible todavía.

Guardado autorizado por Leslie el 4 de noviembre de 2026: commit del incremento de persistencia atómica con validación versionada, pruebas, migración y documentación. No se autoriza publicación en esta confirmación. Desde la suite final solo se modificó documentación; API pública e integración siguen pendientes.
