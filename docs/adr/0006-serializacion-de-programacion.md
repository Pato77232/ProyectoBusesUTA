# ADR 0006: Serialización de escrituras de programación

- **Estado:** Aplicada localmente en ROUTE-SHEETS-06 sección 1, pendiente de revisión humana.
- **Fecha:** 2 de noviembre de 2026.

## Contexto

Guardar un patrón requiere contrastar agenda de bus, vecinos temporales, disponibilidad, períodos e identidades frente a otras hojas. Los escritores antiguos no comparten una transacción integral; bloquear solo asignaciones existentes no protege frente a inserciones fantasma. La publicación tarifaria ya bloquea la hoja con FOR UPDATE y necesita un orden compatible.

## Decisión

Se usa un advisory lock transaccional exclusivo del módulo (clave 1793650000) antes de consultar/bloquear hojas, frecuencias o compromisos. La nueva sesión de programación y la sesión de tarifario lo toman inmediatamente después de BEGIN. BEFORE STATEMENT en INSERT/UPDATE/DELETE de route_sheets, asignaciones, paradas y ciclos hace participar también a escritores antiguos antes de sus locks de filas. El lock se libera al commit/rollback, no depende de sesión ni se emite desde domain/application.

El reemplazo valida todo antes de escribir. Un marcador transaccional local identifica las escrituras integrales: los triggers rechazan mutaciones legadas de hojas programadas, asignaciones legadas de un bus con programación y ciclos legados de un grupo programado. No es un mecanismo de autorización frente a alguien que controla SQL: el aislamiento y los roles se validan en aplicación/HTTP. Los códigos SQL defensivos tendrán traducción HTTP al conectar sección 2; aún no hay ruta de programación.

Los cambios de frecuencia se protegen por la API pública transaccional de ADR 0005. Fleet solo ofrece creación y lectura de los atributos bus/cooperativa/grupo que consume este incremento; no se identificó una operación productiva de edición de esos atributos en el árbol examinado. Si se añade, necesitará versión/sesión pública coherente antes de habilitarla; el lock de Route Sheets no bloquea SQL ajeno de Fleet ni congela inventario de asientos.

## Alternativas y costes

- Solo FOR UPDATE de la hoja: no serializa dos hojas del mismo bus ni limita períodos por grupo.
- Locks por grupo y bus: mayor paralelismo, pero exige migrar de forma conjunta todos los escritores y ordenar sus locks incluso cuando retiran buses. Queda como mejora posterior con pruebas propias.
- Lock global del módulo: menor paralelismo entre cooperativas, a cambio de un protocolo pequeño y comprobable para esta fase. No concede acceso a datos de otra cooperativa; todas las consultas de negocio filtran tenant.

Se acepta técnicamente serializar las escrituras cortas del módulo, sin proceso de optimización ni medición de rendimiento inventada. Las lecturas públicas no se convierten en acceso global. Otros módulos conservan propiedad de tablas; no se introduce SQL cruzado.

## Evidencia y límites

Pruebas con PostgreSQL real: mismo borrador/revisión concurrentes, dos hojas con ciclos superpuestos, inserción legada bloqueada mientras se valida, fallo después de insertar filas y rollback completo. El tarifario conserva su revisión y contenido al editar programación. No implica que publicación/HTTP de sección 2 o viajes D-04 estén implementados.

Refs: [ROUTE-SHEETS-06](../specs/ROUTE-SHEETS-06.md), [ADR 0005](0005-lecturas-publicas-en-transaccion.md).
