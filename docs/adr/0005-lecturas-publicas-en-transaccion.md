# ADR 0005: Lecturas públicas dentro de la transacción de publicación

- **Estado:** Propuesta aplicada localmente en ROUTE-SHEETS-05 sección 2; revisión humana pendiente.
- **Contexto:** monolito modular con PostgreSQL compartido y APIs públicas por index.js. Publicar necesita comprobar frecuencias activas sin permitir una desactivación entre comprobación y commit.

## Decisión técnica

Frecuencias expone `frequencyQueries.forTransaction(executor)` en su composición pública. Infrastructure de Route Sheets proporciona el ejecutor de su transacción ya abierta y recibe una sesión con `findWithStops(id, cooperativeId)`. Frecuencias adquiere FOR SHARE sobre sus propias filas y conserva el bloqueo hasta que termina la transacción. Route Sheets no importa repositorios internos ni consulta tablas ajenas.

Domain/application reciben solo datos y un puerto de lectura, nunca executor, pg ni SQL. El ejecutor se comparte únicamente entre composición/adaptadores; el llamador abre/commit/rollback/libera. La sesión no inicia otra transacción ni se usa después de cerrarla. Se consultan frecuencias en orden canónico de IDs para reducir interbloqueos. El tenant procede de identidad verificada.

## Alternativas consideradas

- Lectura por otro pool: deja una carrera entre validación y commit.
- SQL de Frecuencias en Route Sheets: viola propiedad de módulos.
- Transacción de lectura separada: puede liberar el bloqueo antes de publicar.

## Consecuencias

Hoja, asignaciones y frecuencias pertinentes quedan protegidas durante publicación; estado y snapshot se confirman juntos. No autoriza desactivar frecuencias con ventas futuras después del commit: esa regla tiene su caso de uso. La inmutabilidad de paradas de FREQ-01 sigue vigente.

Los adaptadores dependen del PostgreSQL compartido establecido en ADR 0002; no es un contrato distribuido ni autorización global multi-tenant. Sin proveedor transaccional, publicar falla cerrado, sin volver al flujo antiguo sin tarifa. La prueba PostgreSQL de frozen-route-sheet-tariff.test.js verifica el bloqueo de cambios de estado mientras la publicación está en curso.

Referencia: [ROUTE-SHEETS-05](../specs/ROUTE-SHEETS-05.md). Es una decisión técnica dentro de la implementación solicitada; no se atribuye aceptación individual de arquitectura a otros integrantes.
