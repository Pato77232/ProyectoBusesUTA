# Descripción detallada propuesta para la PR de PAGOS-02

> Preparada el 2 de noviembre de 2026. Borrador local para contrastar con los archivos que se seleccionen y publiquen. No existe una PR de PAGOS-02 acreditada por esta preparación; no implica integración ni cierre.

**Título propuesto:** `feat(pagos): agrega bandeja y aprobación de comprobantes`

**Destino:** develop. **Rama de trabajo:** feature/PAGOS-02-aprobar-comprobante.

**Revisor principal:** Pablo, **@PabloToapanta**. Aceptó revisar PAGOS-02; esa aceptación no aprueba el código anticipadamente.

**Revisión complementaria propuesta:** Leslie, para compatibilidad con Reservas, DTO, plazos y contratos públicos. Su aceptación como segunda revisora no está registrada. No se exige una segunda aprobación por inferencia ni se sustituye a Pablo; Shirley es autora y no se autoaprueba.

---

## Problema y resultado

El incremento de carga PAGOS-01 no completaba la revisión de comprobantes por el oficinista. Esta PR propone la bandeja de pendientes de su cooperativa, lectura privada del archivo y aprobación con intención durable antes de solicitar la confirmación de venta. Permite repetir una aprobación o recuperar una respuesta incierta conservando la identidad del comprobante y el actor original.

También prepara un adaptador del nuevo contrato de lectura autorizado de Reservas, seleccionado en PR #46. Ese adaptador está implementado y probado de forma aislada, pero todavía no está conectado a las rutas actuales: Bookings debe publicar el proveedor, persistencia y evidencia de sus datos antes de integrar el flujo real.

## Alcance funcional del trabajo acumulado

1. **Bandeja de pendientes.** GET /api/v1/payment-proofs para CLERK autenticado, con cooperativa obtenida de la identidad, paginación de 50 elementos y cursor opaco. Consulta comprobantes UPLOADED sin aprobación final; devuelve metadatos seguros y total esperado de reserva en centavos/USD mediante el puerto de lectura anterior, todavía simulado.

2. **Lectura privada.** GET /api/v1/payment-proofs/:paymentProofId/file verifica rol, cooperativa, existencia y estado antes de acceder a almacenamiento. Devuelve bytes con tipo de contenido, disposición inline y nosniff; no devuelve file_key ni rutas locales. Comprobante ajeno e inexistente producen el mismo 404. Las pruebas de transmisión no acreditan validación profunda de PDF/JPEG/PNG en la carga.

3. **Aprobación.** POST /api/v1/payment-proofs/:paymentProofId/approve exige sesión CLERK y CSRF. La identidad del actor y la cooperativa proceden del servidor. El caso de uso persiste primero intención/actor y después invoca confirmSale con bookingId, cooperativeId y paymentProofId. Solo registra approved_at/approved_by tras confirmación aceptada. La respuesta informa decision APPROVED; el estado persistido UPLOADED no se reescribe artificialmente a otro estado.

4. **Idempotencia y recuperación local.** Un comprobante ya aprobado devuelve la decisión persistida. Reintentar una intención pendiente conserva al oficinista original. Una respuesta incierta no se presenta como rechazo definitivo ni aprobación concluida; conserva evidencia para repetir la operación autorizada con la misma identidad. El confirmador sigue simulado: no se demuestra todavía recuperación durable o venta única en Bookings real.

5. **Vínculo de recepción de PAGOS-01.** El aviso anterior se ajusta para transportar bookingId, cooperativeId y paymentProofId. Guardar el archivo y aceptar recepción en Reservas son eventos distintos. La coordinación real recepción–expiración continúa siendo responsabilidad del proveedor de Bookings y de su contrato de mutación.

## Persistencia y migraciones

El diff acumulado de la rama incluye la migración de aprobación 1793130000000-payment-proof-approvals.js y la nueva migración local 1793140000000-payment-proof-approval-intents.js. La primera añade metadatos de aprobación; la segunda agrega approval_requested_at/approval_requested_by y restricciones de coherencia, conservando las aprobaciones previas al completar su intención.

El repositorio PostgreSQL guarda intención y aprobación mediante actualizaciones condicionales filtradas por comprobante, cooperativa y estado pendiente. Los reintentos no sustituyen al actor original. Las pruebas verifican concurrencia, coherencia y reversión/reaplicación en un esquema aislado. No se editaron migraciones publicadas ni se cambió el esquema manualmente.

## Nuevo adaptador consumidor de findForPayment

El diseño de referencia está en docs/contratos/lectura-reservas-pagos.md de PR #46, commit ad74d25, con conformidad documental de Shirley comprobada. El incremento local está delimitado en PAGOS-02 §17.

- Recibe por inyección únicamente la API pública paymentQueries.findForPayment({ bookingId, purpose }, authContext). No importa tablas, repositorios o clases privadas de Auth/Bookings.
- Valida consulta estricta, identificadores opacos y propósitos UPLOAD_PROOF/REVIEW_PAYMENT. No añade restricción UUID ni convierte identificadores a números.
- Proyecta únicamente userId/role/cooperativeId por llamada. CUSTOMER sin cooperativa solo usa UPLOAD_PROOF; CLERK con cooperativa solo REVIEW_PAYMENT. Otros roles, invitados y trabajadores quedan fuera. Comprobar la forma del contexto no autentica un principal: la futura conexión debe obtenerlo de Auth verificado.
- Valida DTO, USD explícito y total entero seguro no negativo. No inventa cero para un dato ausente ni recotiza. Mapear un cero explícito no autoriza una venta gratuita.
- Usa proofWindowStartedAt y duración persistida 180..300 segundos para comprobar expiresAt. createdAt conserva su significado y puede ser diferente. Las fechas se validan como ISO UTC canónicas con milisegundos. No usa configuración viva para extender el plazo.
- Mantiene canUploadProof informado por Bookings y rechaza un true incoherente al alcanzar/superar el límite. No deduce ausencia de recepción de un campo inexistente ni genera elegibilidad. Este primer perfil admite PENDING_PAYMENT; otros estados requieren ampliación explícita del contrato.
- Mapea totalPriceCents a total y canUploadProof a acceptsPaymentProof; devuelve solo datos conocidos en un objeto inmutable. Omite ownerId al CLERK y no copia pasajeros, resumen, documentos, archivos, cookies o tokens.
- Conserva null y no entrega datos de otro propietario/tenant como defensa adicional. Al conectar la bandeja, una relación ausente deberá traducirse a integridad 500; su catch anterior aún no está adaptado.
- Traduce códigos públicos a errores propios seguros: UNAUTHENTICATED 401, FORBIDDEN 403, BOOKING_VALIDATION_ERROR 400, BOOKING_DATA_INTEGRITY_ERROR 500, BOOKING_QUERY_UNAVAILABLE 503 y errores desconocidos a INTERNAL_ERROR 500. No reutiliza mensajes SQL ni un httpStatus arbitrario del proveedor; no modifica el middleware global ni reintenta automáticamente.

**Límite importante:** no se modificó index.js, controlador o caso de uso para conectar este adaptador en esta continuación. Las rutas anteriores conservan su lector y confirmadores simulados y sus firmas previas. No se presenta la proyección HTTP del nuevo contexto ni el flujo conjunto como implementados.

## Archivos y responsabilidades

| Grupo | Archivos o área principal | Propósito |
| --- | --- | --- |
| Casos de uso | application/list-pending-payment-proofs.use-case.js, read-payment-proof-file.use-case.js y approve-payment-proof.use-case.js | Bandeja, acceso privado y decisión con intención previa. |
| Recepción existente | application/upload-payment-proof.use-case.js y domain/booking-payment-proof-notifier.js | Identidad completa del aviso a Reservas. |
| Persistencia | infrastructure/pg-payment-proof.repository.js, domain/payment-proof.repository.js y migraciones aditivas | Filtro de cooperativa, paginación e intención/decisión condicionales. |
| HTTP/composición anterior | interfaces/http/payment-proof.controller.js, payment-proof.routes.js e index.js | Sesión/rol/CSRF y composición del alcance local con simuladores. |
| Adaptador nuevo | domain/booking-payment-query-error.js e infrastructure/bookings-payment-query-adapter.js | Preparación del contrato nuevo de lectura y errores, aún sin conexión. |
| Pruebas nuevas de esta preparación | integration/payments/payment-proof-review.http.test.js y unit/payments/bookings-payment-query-adapter.test.js | 14 integraciones HTTP/Auth/PostgreSQL y 74 pruebas del adaptador. |
| Documentación | PAGOS-01/02, BOOK-07 local, contrato consumidor, estado y evidencia de PAGOS-02 | Trazabilidad de acuerdos, trabajo previo, verificación y límites. |

Las rutas de los grupos backend se refieren a backend/src/modules/payments o backend/tests según corresponda. El listado describe el diff acumulado; no implica que todos esos archivos hayan sido escritos en la última sesión.

## Pruebas y resultados reales

Verificación de la rama local en Windows con Node 24.15.0 y npm 11.6.1, PostgreSQL 16.13-alpine exclusivo en memoria y sufijo de base _test. Contenedor y puerto aislados; retirados al finalizar, sin .env ni cuentas reales.

| Comprobación | Resultado actual |
| --- | --- |
| npm run lint desde backend | Aprobado. |
| npm run format:check desde backend | Fallido en 48 archivos ajenos al incremento; siguen pendientes. |
| Formato explícito de los 32 JS del incremento, incluidas pruebas | Aprobado. |
| Suite dirigida del adaptador nuevo | 74 pruebas aprobadas. |
| npm test completo | 668 unitarias/45 suites y 134 integraciones/14 suites aprobadas: 802 total. |
| Suite HTTP de revisión | Sus 14 pruebas están incluidas en las 134 integraciones anteriores, no se suman otra vez. |
| Arranque real anterior | Health 200 y listado/aprobación sin sesión 401; conserva su fecha/alcance. No se repitió por añadir un adaptador no conectado. |

Las pruebas HTTP de revisión usan sesión/CSRF reales, archivos temporales y PostgreSQL para aislamiento, estados, intención/actor, concurrencia y respuesta perdida. Reservas permanece simulado. Las pruebas HTTP del adaptador usan el middleware real en un arnés de errores; no crean un endpoint de producto ni sustituyen la autenticación.

El historial de intentos fallidos y repeticiones anteriores permanece en la evidencia. La ejecución final del adaptador y npm test terminó con salida 0; no se modificaron pruebas existentes ni límites para lograrlo. El formato global fallido no se trata como defecto inducido ni se exceptúa por esta descripción.

## Cómo reproducir

Preparar PostgreSQL aislado siguiendo docs/testing-database.md, sin apuntar a datos de desarrollo/producción. En backend ejecutar:

```sh
npm run lint
npm run format:check
npm test
node node_modules/jest/bin/jest.js tests/unit/payments/bookings-payment-query-adapter.test.js --runInBand
```

Para la suite HTTP/PostgreSQL dirigida, utilizar NODE_ENV=test y DATABASE_URL de esa base exclusiva y ejecutar Jest sobre tests/integration/payments/payment-proof-review.http.test.js. En Windows los ejecutables npm.cmd evitan conflictos con políticas de PowerShell. No instalar dependencias nuevas para este incremento.

## Reglas y calidad

RN-02 para aislamiento y actor/cooperativa del servidor; RN-40 para coordinar venta sin modificar asientos desde Pagos; RN-52/RN-54 para revisión/aprobación. RN-50/RN-51 informan la lectura de plazo y recepción, sin implementar aquí expiración ni decisiones de corrección.

Responsabilidad por caso de uso, puertos pequeños e inyección de dependencias. El dominio no importa Express/pg/Auth; las interfaces traducen HTTP y el repositorio filtra por tenant. La nueva traducción usa errores propios y campos mínimos, sin cambiar el middleware común. No incluye interfaz frontend ni requiere cambios de DESIGN.md. No introduce defectos académicos autorizados.

## Dependencias, riesgos y siguiente incremento

- Develop consultado en 3d053a4, con PR #45 integrada. Esta rama mantiene HEAD 4e6bbf7 y base común 518c46b; no se incorporó ni verificó la combinación con el develop actual. La comparación remota no mostró cambios backend de Payments, pero sí composición y documentación compartida.
- PR #46 aporta diseño y borradores de dependencias; seguía abierta en la consulta. Su aprobación documental no aprueba este código ni publica el proveedor de Leslie.
- Leslie debe publicar proveedor/persistencia de inicio, duración y recepción y sus pruebas. Después se adaptarán explícitamente carga/listado, contexto HTTP, null de bandeja y composición, y se verificará el flujo con ambos módulos reales y arranque.
- Recepción/confirmación/liberación reales, versiones de comprobantes, importe observado/diferencias, trabajadores durables, rechazo, correcciones, caja, invitado, correo y boletos/QR conservan incrementos propios. No se declaran implementados por esta PR.
- Los 48 avisos globales de formato y cualquier incompatibilidad de base deben resolverse o recibir el tratamiento humano explícito correspondiente antes de integrar; aquí no se concede esa excepción.

## Estado de revisión y publicación

Propuesta para PR en borrador hacia develop. Pablo revisa arquitectura, permisos, persistencia, idempotencia, pruebas y alcance del adaptador. Se propone revisión complementaria de Leslie sobre compatibilidad y límites del contrato de Reservas. Ninguna herramienta de IA sustituye esas revisiones.

No se realizaron commits, push, merge, rebase ni tags ni se abrió PR. El directorio conserva también borradores PAGOS-CORR-01/PAGOS-CAJA-01 de otra actividad: separar su documentación del incremento funcional. Al seleccionar cambios, conciliar referencias/hunks de estado-proyecto para no publicar enlaces a specs excluidas. No usar una selección global de todos los archivos.

## Referencias y asistencia de IA

- Spec principal: docs/specs/PAGOS-02.md, especialmente §§13–17.
- Relacionadas: docs/specs/PAGOS-01.md y docs/specs/BOOK-07.md; el BOOK-07-L05 posterior fue remitido por Leslie como borrador, sin implementación inspeccionada.
- Contrato seleccionado: [lector de Reservas para Pagos, ad74d25](https://github.com/Pato77232/ProyectoBusesUTA/blob/ad74d25eae8163094a287a2d4b854ddb04b036c6/docs/contratos/lectura-reservas-pagos.md).
- Evidencia: [HTTP/Auth/PostgreSQL](2026-11-02-integracion-http.md), [adaptador nuevo](2026-11-02-adaptador-lector.md) y [preparación anterior](2026-11-02-preparacion-pr.md).

Codex asistió en revisión del estado y contratos, implementación del adaptador, escritura de las suites nuevas, ejecución de verificaciones y documentación. El trabajo funcional anterior se conserva como implementación encontrada en la rama; no se atribuye a esta sesión una integración o aprobación humana inexistente.
