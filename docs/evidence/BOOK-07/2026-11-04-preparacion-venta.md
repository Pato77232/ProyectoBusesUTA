# BOOK-07: preparación del incremento de confirmación de venta

4 de noviembre de 2026, America/Guayaquil. Solicitud compartida por Leslie: Shirley necesita confirmSale real para PAGOS-02. Asistencia de Codex en inspección y documentación; no aprobación humana de código.

Estado inicial limpio, rama de cotización 32afe9d publicada. Fetch origin/develop comprobó ae88e0c; consulta GitHub de PR abiertas sin resultados. Preparada feature/BOOK-07-confirmacion-venta desde origin/develop; no checkout de main/develop, rebase, merge, commit o push. El commit de cotización queda en su rama independiente.

Se revisaron BOOK-07, BOOK-07-L05, PAGOS-02, conciliación de contratos y el código de ambos módulos. Bookings no expone venta; Pagos construye confirmador simulado y exige true. Existe recepción persistida real y una intención de aprobación en el consumidor, pero falta el puerto público que permita a Bookings verificar esa intención/versionado sin acceder a tablas privadas. El estado UPLOADED por sí solo no acredita aprobación autorizada. Las validaciones de ciclo de vida deben ampliarse para reconocer SOLD con seguridad.

Se añade BOOK-07 §13, reutilizando T2/T3 existentes: acuerdos confirmados, propuesta de autorización por puerto, compatibilidad de respuesta, incrementos y pruebas. No se inventan firmas o códigos aprobados ni disponibilidad de operaciones. Resultado: borrador revisable; requiere conciliar los puntos concretos con Shirley antes de implementar su conexión.

Solo documentación. No nuevas dependencias, secretos, bases, migraciones o frontend. Sin cambios funcionales no se repiten suites; los 2498 tests de cotización son evidencia de otro incremento, no de confirmSale. git diff --check y revisión documental del diff; sin integración ni cierre declarado.

## Ampliación de diseño y casos, mientras responde Shirley

Se recuperó el acceso a la carpeta original tras el fallo anterior de revisión automática por límite de uso. Ese acceso rechazado no ejecutó su comando. Nueva inspección/fetch confirma base ae88e0c y ninguna PR abierta accesible. Solo se amplía documentación en la misma rama, conservando los cambios previos.

Respuesta compartida de Shirley registrada: confirma traducción de resultado/errores, propone lectura de intención e indica ausencia de versión. Versionado proofVersion sigue como propuesta de conciliación, no requisito aprobado ni código disponible.

Documento nuevo contratos/confirmacion-venta-reservas-pruebas-propuesta.md: 32 escenarios previstos, invariantes, barreras PostgreSQL, snapshots de rollback y orden de bloqueos compatible con creación/recepción/expiración. Se inspeccionaron el wrapper de instalación, la migración de recepción, los repositorios de Bookings y de intención de Payments y el harness existente de carreras. Restricción activa solo admite PENDING_PAYMENT/EXPIRED; el dominio exige RESERVED. Se registra el trabajo futuro de adaptación, sin editar esquema ni código.

Matriz separa confirmados y pendientes (versionado, contexto, importe/históricos/recuperación). No pruebas Jest nuevas, casos omitidos ni falsos verdes. Para este cambio documental no se ejecutan lint/npm test/PostgreSQL; git diff --check y comprobación de enlaces locales. No dependencias/secretos/bases persistentes/frontend/commits/publicación. Revisión humana pendiente; confirmSale sigue sin implementarse.
