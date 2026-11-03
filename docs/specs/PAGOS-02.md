# PAGOS-02: Revisar y aprobar comprobantes

> Estado vigente de #55: actualización local sobre develop b4fe717, documentada
> al final de §18 y en la evidencia del lector. PR publicada en ca63a36 sigue
> Draft; no se ha actualizado su cabeza. Registros anteriores conservan sus
> fechas y no describen por sí solos el estado actual de publicación/proveedor.

- **ID local:** PAGOS-02
- **Módulo:** `payments`
- **Alcance de commit:** `pagos`
- **Responsable:** Shirley
- **Revisor:** Pablo; aceptó revisar este incremento en el mensaje humano compartido el 2 de noviembre de 2026. No implica aprobación del código.
- **Estado:** En desarrollo; contrato con BOOK-07 acordado el 29 de octubre de 2026; implementación productiva pendiente.
- **Dependencias:** PAGOS-01; coordinación técnica con BOOK-07 y `bookings`.

> Contrato compartido aceptado por Leslie y Shirley el 29 de octubre de 2026. Las decisiones y el trabajo pendiente quedan registrados en esta spec y en BOOK-07.

## 1. Objetivo

Permitir que un oficinista consulte comprobantes `UPLOADED` de su cooperativa, examine el archivo de forma privada y apruebe un comprobante válido. La aprobación invoca `confirmSale` mediante un puerto de `payments`; pagos registra la decisión solo después de una confirmación aceptada.

## 2. Reglas de negocio involucradas

- **RN-02:** todo acceso interno queda filtrado por el `cooperative_id` de la identidad autenticada; nunca se toma del query, ruta o cuerpo.
- **RN-40:** aprobar no crea una segunda venta ni cambia directamente ocupaciones/asientos; la operación autorizada de `bookings` confirma la venta.
- **RN-52:** el Oficinista revisa comprobantes recibidos.
- **RN-54:** al aprobar un pago válido se confirma la venta y queda disponible el flujo posterior de boleto.

La bandeja muestra exclusivamente comprobantes `UPLOADED` aún no aprobados. No expone la ruta del almacenamiento ni permite leer comprobantes de otra cooperativa. El rechazo con justificación corresponde a PAGOS-03.

## 3. Alcance

**Incluye:** consulta paginada de comprobantes pendientes por cooperativa; lectura privada del archivo para revisión; aprobación autenticada por `CLERK`; invocación idempotente del puerto `confirmSale`; y registro local de quién y cuándo aprobó.

**No incluye:** interfaz web, rechazo, liberación de reservas, emisión de boleto/QR, implementación interna de `bookings` ni confirmación basada en datos del navegador. La coordinación contractual con BOOK-07 sí se documenta aquí y en esa spec.

## 4. Supuestos

- **Supuesto de acceso:** solo el rol `CLERK` puede listar, leer y aprobar. `COOPERATIVE_ADMIN` no obtiene permisos de aprobación en esta tarea.
- **Supuesto de aislamiento:** `cooperative_id` se obtiene de `request.auth.user.cooperative_id`, emitido por la autenticación existente; no se acepta del cliente.
- **Supuesto de consulta:** `GET /api/v1/payment-proofs` devuelve únicamente comprobantes `UPLOADED` pendientes, con paginación técnica de 50 elementos por página y cursor opaco.
- **Supuesto de lectura del archivo:** se añade `GET /api/v1/payment-proofs/:paymentProofId/file`, protegido por autenticación y el mismo filtro de cooperativa; el contenido se transmite en línea con su tipo validado, sin revelar `file_key` ni rutas locales.
- **Contrato acordado con Leslie:** `confirmSale({ bookingId, cooperativeId, paymentProofId })`; `paymentProofId` es la clave idempotente. Un reintento con la misma clave y vínculos consulta primero la venta persistida y devuelve el resultado previo aunque haya transcurrido el plazo. Timeout o pérdida de respuesta no son rechazo definitivo.
- **Vínculo de recepción acordado:** `markPaymentProofReceived({ bookingId, cooperativeId, paymentProofId })` permite a `bookings` conservar el vínculo aceptado antes de `confirmSale`. La spec de PAGOS-01 ya refleja el cambio; la implementación se ajusta en esta rama.
- **Importe acordado:** `bookings` es autoridad del total final en centavos/USD. `payments` muestra ese total al oficinista y este lo contrasta con el importe visible en el comprobante durante la revisión; `bookings` no puede verificar por sí solo el dinero transferido.
- **Plazo acordado:** los 3–5 minutos configurables aplican a recibir el comprobante. Si `bookings` aceptó la recepción a tiempo, la reserva permanece en revisión y puede aprobarse después del plazo. Recepción, expiración y confirmación se coordinan para que solo una transición incompatible prevalezca.
- **Persistencia y recuperación acordadas:** `payments` valida el permiso del oficinista y su cooperativa; persiste la intención de aprobación y el actor como pendiente antes de llamar a `bookings`; solo registra aprobación final tras confirmación. Ante respuesta perdida, reintenta con el mismo `paymentProofId`.
- **Supuesto de implementación:** mientras BOOK-07 no exponga el contrato público productivo, se conecta un adaptador simulado del puerto en la composición de pagos. No se importa ninguna capa interna de `bookings`.

## 5. Datos

### Entrada y salida

| Operación | Entrada | Salida |
|---|---|---|
| Listar | cursor opcional; cooperativa desde identidad autenticada | comprobantes pendientes de esa cooperativa, metadatos seguros, total de reserva en centavos y USD consultado a `bookings`, `nextCursor` |
| Leer archivo | `paymentProofId` UUID; cooperativa desde identidad | bytes del archivo validado y tipo de contenido; sin ruta ni clave interna |
| Aprobar | `paymentProofId` UUID; identidad de oficinista autenticada | identificador, decisión `APPROVED` y fecha de decisión |

El listado no incluye datos personales innecesarios. Incluye `bookingId`, total de reserva en centavos, moneda USD, fecha de carga, nombre original saneado, tipo y tamaño para que el oficinista contraste el total con el comprobante. El total procede de `bookings`; el `file_key` nunca se devuelve.

### Persistencia

Crear migraciones nuevas; no editar migraciones existentes. `payment_proofs` conserva `approved_at TIMESTAMPTZ NULL` y `approved_by UUID NULL`, y agrega `approval_requested_at TIMESTAMPTZ NULL` y `approval_requested_by UUID NULL`. Cada pareja debe estar completa o vacía; una aprobación final exige una intención previa. No se crean FKs físicas a `users`; ambos actores son relaciones lógicas de identidades verificadas. Los registros existentes quedan sin intención y conservan sus decisiones anteriores.

El repositorio filtra por `cooperative_id`, `status = 'UPLOADED'` y `approved_at IS NULL`. La primera solicitud guarda condicionalmente intención, hora y actor; los reintentos reutilizan ese actor. Después de confirmación, una actualización condicional registra la aprobación final. Una respuesta incierta conserva la intención y permite reintentar con la misma clave.

### Puerto de dominio

Definir en `payments/domain` un puerto `BookingSaleConfirmer.confirmSale({ bookingId, cooperativeId, paymentProofId })`. El caso de uso no importa Express, `pg` ni clases concretas. La composición actual conserva el adaptador simulado idempotente hasta que BOOK-07 exponga la API pública real.

## 6. Endpoints

| Método | Ruta | Roles y protección | Resultado |
|---|---|---|---|
| GET | `/api/v1/payment-proofs` | `authenticate`, `authorize('CLERK')` | página de comprobantes pendientes de la cooperativa autenticada |
| GET | `/api/v1/payment-proofs/:paymentProofId/file` | `authenticate`, `authorize('CLERK')` | archivo privado de la misma cooperativa |
| POST | `/api/v1/payment-proofs/:paymentProofId/approve` | `authenticate`, `authorize('CLERK')`, `csrfProtection` | 200 y decisión aprobada tras `confirmSale` aceptado |

Los endpoints no reciben `cooperative_id`, `booking_id`, `approved_by`, importe ni estado desde el cliente. Un identificador inexistente y uno de otra cooperativa producen el mismo 404.

## 7. Criterios de aceptación

- [ ] **Dado** un `CLERK` autenticado, **cuando** lista la bandeja, **entonces** recibe solo comprobantes `UPLOADED` pendientes de su cooperativa.
- [ ] **Dado** un `CLERK` de otra cooperativa, **cuando** consulta un comprobante ajeno o su archivo, **entonces** recibe 404 y no se exponen metadatos ni bytes.
- [ ] **Dado** un archivo pendiente de su cooperativa, **cuando** lo consulta, **entonces** se entrega el contenido privado validado sin exponer clave o ruta.
- [ ] **Dado** un comprobante `UPLOADED`, **cuando** el oficinista aprueba con CSRF válido, **entonces** se llama `confirmSale` con la identidad del comprobante y cooperativa confiable y se registra la aprobación solo tras aceptación.
- [ ] **Dado** el importe visible en el comprobante, **cuando** el oficinista lo revisa, **entonces** `payments` lo contrasta con el total de reserva en centavos/USD obtenido desde la fuente autorizada de `bookings` antes de aprobar.
- [ ] **Dado** un comprobante cuya recepción fue aceptada antes del vencimiento, **cuando** se revisa después del plazo de carga, **entonces** puede aprobarse y no se expira mientras permanece en revisión.
- [ ] **Dado** que se inicia una aprobación, **cuando** `payments` llama a `confirmSale`, **entonces** la intención y el actor ya constan como pendientes; la aprobación final solo se persiste tras una confirmación.
- [ ] **Dado** un reintento autorizado por otro oficinista, **cuando** ya hay una intención pendiente, **entonces** se conserva el actor original y la misma clave del comprobante.
- [ ] **Dado** un comprobante ya aprobado, **cuando** se repite la aprobación, **entonces** la respuesta es idempotente y no crea una segunda venta.
- [ ] **Dado** un timeout o resultado incierto de `confirmSale`, **cuando** se procesa la solicitud, **entonces** no se marca aprobado y se puede reintentar con la misma clave estable.
- [ ] **Dado** un comprobante ausente, expirado, ya no pendiente o perteneciente a otra cooperativa, **cuando** se intenta aprobar, **entonces** no se confirma una venta ni se modifica otra cooperativa.
- [ ] **Dado** un rol distinto de `CLERK` o falta de CSRF, **cuando** intenta leer o aprobar, **entonces** auth rechaza la operación antes de acceder al archivo o invocar `confirmSale`.
- [ ] **Dado** una carrera de dos aprobaciones, **cuando** ambas llegan simultáneamente, **entonces** la clave estable y actualización condicional evitan duplicar la venta y la decisión persistida.

## 8. Errores y casos borde

- `401 UNAUTHENTICATED` y `403 FORBIDDEN` conservan el formato de errores del proyecto.
- Comprobante inexistente o ajeno: 404 sin revelar existencia.
- Comprobante no pendiente o rechazo definitivo de `confirmSale`: 409; no se marca aprobado.
- Resultado incierto de `confirmSale`: 503; conservar estado local pendiente y permitir reintentar.
- Total de reserva no disponible o cooperativa discordante al cargar bandeja: 503; no mostrar una cifra que no pudo verificarse.
- Falla al leer almacenamiento: error interno controlado; no devolver la ruta ni detalles del sistema de archivos.
- Si `confirmSale` aceptó pero se perdió su respuesta, el reintento con el mismo `paymentProofId` debe devolver el mismo resultado confirmado antes de escribir `approved_at`.

## 9. Pruebas

- Unitarias de listado y aprobación: aislamiento por cooperativa, rol, estados, rechazo, timeout e idempotencia.
- Pruebas del repositorio PostgreSQL: paginación, filtro tenant, actualización condicional y metadatos de aprobación.
- Integración HTTP: bandeja, lectura privada, CSRF y permisos.
- El adaptador simulado acredita el contrato local propuesto; no sustituye aceptación ni pruebas de integración del contrato real con Leslie/BOOK-07.

## 10. Usabilidad y seguridad

El backend no incluye una interfaz en esta tarea. Los errores permiten a una futura bandeja distinguir acceso denegado, comprobante no disponible y resultado incierto; no entregan información de otra cooperativa. El archivo solo se sirve tras comprobar identidad, rol, estado y pertenencia.

## 11. Defecto inducido

**No aplica.**

## 12. Dependencias y coordinación

- **Requiere:** PAGOS-01 para tabla, almacenamiento privado y registros `UPLOADED`; auth para `CLERK`, cooperativa autenticada y CSRF.
- **Contrato compartido acordado:** Leslie y Shirley aceptaron el 29 de octubre de 2026 la firma, vínculo de recepción, validación del importe, plazo, reintentos e intención pendiente descritos en §4 y BOOK-07. La ampliación de `markPaymentProofReceived` se refleja en la spec de PAGOS-01 y en el código de pagos de esta rama; BOOK-07 aún debe implementar su lado público.
- **Siguiente tarea:** PAGOS-03 define rechazo con justificación y `releaseBooking`; debe preservar la exclusión mutua con una aprobación ya confirmada.
- **Dependiente:** BOLETOS-01 emite QR tras confirmar la venta, en una spec separada.

## 13. Evidencia de implementación local

- Implementados en la rama dependiente de PAGOS-01: bandeja paginada, lectura privada, aprobación por puerto, adaptador simulado y migración aditiva de metadatos de aprobación.
- PAGOS-01 está integrado en `origin/develop` desde `f26415d` (segundo padre `518c46b`); esta rama comparte esa base e incorpora el ajuste coordinado del contrato de recepción de PAGOS-01 junto con PAGOS-02. El 1 de noviembre de 2026 se ejecutó `git fetch origin`: `origin/develop` avanzó a `0b4041e`. La comparación no muestra cambios directos en el módulo ni las pruebas de pagos; la nueva base no se incorporó a esta rama.
- Leslie respondió el 29 de octubre de 2026 y Shirley aceptó sus precisiones. El contrato ya se refleja en ambas specs, el puerto de pagos y el aviso de recepción. La composición aún usa adaptadores simulados porque BOOK-07 no expone todavía la API pública productiva.
- Se agregó persistencia durable de intención y oficinista en una migración nueva; los reintentos conservan al actor original, la bandeja consulta el total de la reserva por el puerto de lectura y lo presenta en centavos/USD.
- `npm run lint`: aprobado tras los cambios.
- `npm test`: aprobado; 44 suites/594 pruebas unitarias y 13 suites/120 pruebas de integración. PostgreSQL verifica dos intenciones concurrentes conservando un único actor, y la migración conserva actor/fecha de aprobaciones previas. La primera ejecución sin permiso de loopback falló en la prueba HTTP; la suite completa repetida con acceso autorizado pasó.
- La primera integración reveló solo una expectativa de orden de columnas; se corrigió para reflejar que la migración aditiva agrega columnas al final y se repitió la suite completa en verde.
- Prettier de los archivos JavaScript modificados: aprobado.
- `npm run format:check` global sigue reportando 48 archivos existentes de auth, fleet, route-sheets y shared; no pertenecen a este cambio y no se modificaron.
- Verificación repetida el 1 de noviembre de 2026: `npm run lint` aprobado; `npm run test:unit`, 44 suites/594 pruebas aprobadas; `npm run test:integration`, 13 suites/120 pruebas PostgreSQL aprobadas. `npm run format:check` mantiene 48 archivos ajenos pendientes. La base aislada de Docker Compose se detuvo y eliminó al terminar.
- No se considera cerrada ni integrada; la API productiva de `bookings` y la prueba del flujo real con Leslie/BOOK-07 siguen pendientes.

## 14. Dependencia de lectura y conciliación — 2 de noviembre de 2026

Leslie remitió BOOK-06-L04 y BOOK-07-L05 completos, aún sin commit/publicación de sus borradores, y propuso cerrar primero la lectura autorizada. El [contrato propuesto de `findForPayment`](../pagos-reservas-find-for-payment.md) distingue carga del comprador y revisión por CLERK de su cooperativa. No concede revisión/aprobación a COOPERATIVE_ADMIN ni agrega acceso de invitados.

El listado local llama hoy `findForPayment(bookingId)` y solo recibe `cooperativeId` en su entrada; una futura adaptación al contexto verificado requiere cambios explícitos en controlador/caso de uso, puerto y pruebas, después de aprobar el contrato. No se modifica silenciosamente la firma. El total proviene de Reservas y un fallo al consultarlo no equivale a cero o ausencia de reserva.

La identidad/versionado de archivos, el bloqueo de reemplazos durante aprobación pendiente o incierta y el registro de importe observado/moneda/actor siguen en conciliación; el código actual no acredita esas funciones. La intención/actor de aprobación local que documenta §13 se conserva como evidencia del alcance anterior, con adaptador simulado.

Pablo aceptó revisar los incrementos PAGOS-02, PAGOS-03, PAGOS-CORR-01 y PAGOS-CAJA-01 en PR separadas; esa respuesta no aprueba anticipadamente cambios ni publica las ramas. Su propuesta de correo/contexto invitado requiere el acuerdo y las specs correspondientes. La recomendación PDF/JPEG/PNG quedó posteriormente ratificada según su respuesta humana registrada en §16; el máximo de 5 MiB ya estaba confirmado.

Esta continuación es documental: sin nuevas pruebas funcionales, cambios de código ni revisión humana de implementación. No se declara cerrada/integrada PAGOS-02 ni la actividad del día 1.

### Segunda propuesta de lectura y compatibilidad del listado

Leslie remitió una propuesta con 20 escenarios. El [contrato conciliado para responder](../pagos-reservas-find-for-payment.md) recomienda su firma de dos argumentos y propósito `REVIEW_PAYMENT`, sus nombres públicos `totalPriceCents`/`canUploadProof` y fechas ISO, sin una aceptación atribuida por redactarlo. Se propone omitir `ownerId` al CLERK porque el listado no lo necesita.

La adaptación futura debe modificar explícitamente el paso de contexto al listado, el mapeo de total y la validación de moneda. Además, el catch actual convierte todos los errores de lectura en no disponible: no preserva todavía la separación propuesta entre 401/403, integridad 500 y temporal 503. La nueva clasificación, sus clases y middleware deben acordarse antes de cambiar el comportamiento documentado del alcance anterior. No se afirma implementada por actualizar esta spec.

La persistencia de Leslie solo admite PENDING_PAYMENT según su reporte. La lectura futura de una reserva en revisión tras recepción aceptada (F11) queda condicionada a L-04, sin inventar estados ni vínculos para habilitar aprobación. Siguen pendientes los cinco puntos de §9 del documento principal y los contratos propios de las mutaciones.

## 15. Nueva verificación y preparación de revisión — 2 de noviembre de 2026

Se comprobó nuevamente la implementación local anterior, sin escribir funcionalidad ni adaptar contratos todavía pendientes. [Evidencia y borrador de PR](../evidence/PAGOS-02/2026-11-02-preparacion-pr.md): lint aprobado; `npm test` completo aprobado con 594 unitarias y 120 integraciones en PostgreSQL 16.13 aislado; formato de los 28 JS del incremento aprobado. `format:check` global falla en 48 archivos ajenos. El primer intento unitario tuvo seis fallos EACCES de HTTP local; la repetición permitida pasó sin modificar pruebas.

Se verificó el arranque real de `server.js`: health 200 con conexión a la base y listado/aprobación sin sesión 401. Servidor y PostgreSQL temporal retirados. Esto no acredita venta real: los adaptadores de Reservas siguen simulados.

GitHub mantiene develop en `8fdf7e4`; la comparación desde la base común `518c46b` no muestra nuevos cambios del backend de Payments, pero sí de composición y documentación compartida. No se incorporó ni se probó esa combinación. No se encontró PR abierta de PAGOS-02 ni se publicó esta rama.

La solicitud de continuar y preparar revisión no aporta respuestas humanas nuevas sobre los cinco puntos de lectura ni sobre recepción/confirmación. Se prepara revisión en borrador del alcance local anterior; conexión productiva e integración pendientes. Correcciones/caja son incrementos separados y no se incluyen por seleccionar todos los cambios del directorio. Sin dependencias nuevas, commits, push, merge, rebase ni tags.

## 16. Incremento independiente de pruebas HTTP con PostgreSQL

El 2 de noviembre Shirley pidió continuar mientras espera a Leslie y compartió la respuesta humana de Pablo. Se trabaja en las pruebas de integración ya previstas en §9: montar las APIs públicas de Auth y Payments con PostgreSQL aislado y almacenamiento temporal; comprobar identidad/rol/CSRF reales, filtro de cooperativa, lectura privada, intención durable, idempotencia y recuperación de respuesta perdida. Las identidades son exclusivamente ficticias de QA; su preparación de datos no implementa AUTH-06 ni acredita una cuenta operativa.

Archivo añadido: `backend/tests/integration/payments/payment-proof-review.http.test.js`, con 14 pruebas. Sin cambios de producción, dependencias, migraciones, frontend o contrato de lectura. Los puertos de Reservas siguen simulados y los escenarios no acreditan venta real. La composición productiva no cambia; se comprobó el montaje de prueba y la suite completa. Son pruebas dependientes del PAGOS-02 local, no una PR de pruebas independiente que ya pase sobre develop.

Pablo confirmó origen de autenticación y matriz de permisos. La proyección `{ userId, role, cooperativeId }` y los códigos nuevos de lectura siguen propuestos para conciliación; no se adaptan por esta prueba. Confirmó también la ratificación de PDF/JPEG/PNG y 5 MiB, sin afirmar validación implementada. Invitado, correo y AUTH-06 tienen borradores locales reportados, aún sin proveedor/endpoint disponible ni publicación acreditada.

Resultado final: lint aprobado; 14 pruebas nuevas dirigidas aprobadas; `npm test` completo con 594 unitarias y 134 integraciones aprobadas (728 total). Formato de los 29 JS del incremento aprobado; formato global fallido en 48 archivos ajenos. Una primera ejecución global terminó con salida 1 sin detalle de integración; repetición de integración y después npm test completo aprobaron conservando salida, sin atribuir una causa no comprobada. Sin cambios a pruebas anteriores ni límites.

[Evidencia completa](../evidence/PAGOS-02/2026-11-02-integracion-http.md): base temporal exclusiva retirada, snapshot de los 20 archivos backend previos conservado y nuevos límites de alcance documentados. Revisión humana, contratos de Leslie y combinación con develop pendientes. Sin commits ni publicación.

## 17. Adaptador consumidor del lector decidido en PR #46

### Autorización, objetivo y límite

El 2 de noviembre Shirley pidió continuar su trabajo y preparar la descripción detallada de PR. GitHub confirma su revisión APPROVED sobre `ad74d25` de [PR #46](https://github.com/Pato77232/ProyectoBusesUTA/pull/46), cuyo [contrato seleccionado](https://github.com/Pato77232/ProyectoBusesUTA/blob/ad74d25eae8163094a287a2d4b854ddb04b036c6/docs/contratos/lectura-reservas-pagos.md) incorpora `proofWindowStartedAt`, contexto mínimo y errores explícitos. La aprobación es documental; la autorización de trabajo de esta sesión cubre este incremento del consumidor, no el proveedor de Bookings ni sus mutaciones.

Resultado pequeño verificable: un adaptador de Payments que recibe exclusivamente `paymentQueries.findForPayment({ bookingId, purpose }, authContext)` por inyección, proyecta contexto mínimo por llamada, valida el DTO y traduce códigos públicos a errores propios seguros. No importa clases/repositorios de Auth/Bookings. No se conecta todavía a `index.js`, controladores o casos de uso actuales: no existe proveedor real publicado ni se inventa elegibilidad con simuladores. La rama mantiene los endpoints anteriores y sus límites documentados; no se presenta este adaptador como carga/venta productiva.

### Archivos y contrato de este incremento

- `domain/booking-payment-query-error.js`: errores propios con códigos/HTTP/mensajes seguros para UNAUTHENTICATED 401, FORBIDDEN 403, BOOKING_VALIDATION_ERROR 400, BOOKING_DATA_INTEGRITY_ERROR 500, BOOKING_QUERY_UNAVAILABLE 503 e INTERNAL_ERROR 500. No altera el middleware común.
- `infrastructure/bookings-payment-query-adapter.js`: firma nueva de dos argumentos; no sobrecarga antigua sin contexto. Propósitos UPLOAD_PROOF para CUSTOMER sin cooperativa y REVIEW_PAYMENT para CLERK de cooperativa verificada. Ninguna propiedad del contexto demuestra autenticidad: debe proceder del flujo HTTP autenticado al conectarlo en el siguiente incremento.
- `tests/unit/payments/bookings-payment-query-adapter.test.js`: contrato, permisos, privacidad, coherencia de DTO/plazo y errores, incluida traducción por el middleware HTTP real. No adapta ni debilita pruebas anteriores.

Consulta estricta con bookingId opaco no vacío y propósito cerrado; sin conversiones numéricas ni restricción UUID. Proyectar solo userId/role/cooperativeId, sin conservar contexto entre llamadas ni aceptar tokens como autorización de trabajador. Denegar ausencia de contexto, rol/propósito o cooperativa incoherentes antes de invocar al proveedor.

DTO público: IDs opacos; totalPriceCents entero seguro no negativo y USD explícito; fechas ISO UTC canónicas con milisegundos; proofWindowSeconds entero 180..300 y expiresAt exactamente igual a proofWindowStartedAt más duración persistida. createdAt se valida como fecha sin inferir que sea el inicio. Este primer adaptador reconoce PENDING_PAYMENT, único estado concreto delimitado; otros estados requieren ampliación expresa del contrato de proveedor. Un true incoherente con estado/plazo es integridad 500. Un false válido se conserva sin inventar su causa; solo Bookings acredita recepción y ausencia de ella.

Se proyectan únicamente los campos públicos conocidos: totalPriceCents se mapea al total interno y canUploadProof a acceptsPaymentProof. ownerId se exige y devuelve solo para carga. IDs distintos al solicitado son integridad; propietario o tenant ajenos producen null sin entregar datos. Null del proveedor se conserva; al adaptar después la bandeja se traducirá su relación ausente a BOOKING_DATA_INTEGRITY_ERROR, conforme a PR #46. No se cambia todavía su catch anterior.

### Criterios y comprobación

- [x] Enviar consulta/contexto nuevos sin campos extra, sin mutar argumentos ni importar internos ajenos.
- [x] Denegar llamadas sin contexto o con rol/propósito/tenant incoherentes antes del proveedor.
- [x] Conservar total/vencimiento persistidos y permitir createdAt distinto del inicio real.
- [x] Rechazar DTO incompleto/corrupto, moneda no validada o plazo incoherente sin inventar valores.
- [x] Mantener null y privacidad entre propietarios/cooperativas; no entregar ownerId al CLERK ni estructuras privadas.
- [x] Preservar 400/401/403/500/503 con mensajes seguros; error no clasificado es INTERNAL_ERROR 500, sin convertirlo en temporal.
- [x] No reintentar automáticamente ni convertir una lectura en aceptación transaccional.

Ejecutar pruebas dirigidas y, desde backend, lint, format:check y npm test con PostgreSQL aislado. No hay cambio de composición productiva; no se repite su arranque por añadir un adaptador no conectado. SOLID: límite por API pública, dependencia inyectada y responsabilidad de traducción; sin UI ni cambios a DESIGN.md. Sin dependencias nuevas, migraciones, defectos inducidos, commits o publicación. Registrar resultados reales y descripción de PR al terminar; revisión principal de Pablo ya aceptada, revisión complementaria de Leslie propuesta, no asumida.

### Resultado local del incremento

74 pruebas nuevas del adaptador aprobadas; lint aprobado; formato propio de 32 JS aprobado; formato global fallido en 48 archivos ajenos. `npm test` con PostgreSQL aislado: 668 unitarias y 134 integraciones aprobadas, 802 total. Los criterios marcados son cobertura local del consumidor, no aceptación humana ni integración del proveedor. Base temporal retirada y trabajo previo conservado.

[Evidencia y límites](../evidence/PAGOS-02/2026-11-02-adaptador-lector.md) y [descripción detallada de PR](../evidence/PAGOS-02/descripcion-pr.md). Sigue pendiente conexión a rutas/proveedor real, clasificación del null de bandeja, otros estados explícitos y verificación de la combinación con develop `3d053a4`. No hay PR publicada de PAGOS-02 en las consultas realizadas.

## Pantalla posterior a PR #47

El incremento web solicitado por Shirley el 2 de noviembre se separa en
[PAGOS-WEB-01](PAGOS-WEB-01.md), sin reabrir bandeja/aprobación backend ya
integradas en PR #47. La pantalla de lectura no acredita proveedor real de
Reservas ni venta productiva. Evidencia y revisión humana en su spec propia.


## 18. Consumidor HTTP de lectura con contexto — 3 de noviembre de 2026

Shirley pidió continuar sus pendientes. Se aplica el diseño ya decidido del
lector, sin pedir otra aceptación genérica ni aprobar mutaciones pendientes.
Base comprobada: develop f5b9bde; rama feature/PAGOS-02-lector-contexto. La pantalla
700bcf3 está publicada en PR #54, abierta; no se modifica su rama ni se marca integrada.

El lector de Leslie ya es accesible en feature/BOOK-03-resumen-creacion-dominio:
index.js expone paymentQueries.findForPayment y payment-booking.js proyecta
proofWindowStartedAt/canUploadProof conforme al contrato publicado. Código
consultado mediante GitHub, no incorporado ni ejecutado como proveedor local.
Recepción, confirmSale y releaseBooking siguen sin disponibilidad acreditada.

### Incremento autorizado y límites

Preparar una composición pública explícita createPaymentReviewModule que recibe
paymentQueries por inyección, usa el adaptador estricto de §17 y expone solamente
GET listado/archivo. Ningún fallback al simulador ni métodos de escritura.
La composición productiva actual se conserva hasta integrar la API de Bookings;
este incremento queda listo para que el responsable de composición lo conecte
con bookings.paymentQueries. No habilita carga/venta ficticia ni aprobación.

El nuevo caso de uso exige authContext mínimo de CLERK y toma de él la cooperativa
antes de consultar el repositorio. HTTP proyecta userId/role/cooperativeId desde
request.auth.user, nunca body/query. Llama al lector con propósito REVIEW_PAYMENT.
Conserva total en centavos y USD, cursor y DTO HTTP existentes; una relación null,
ajena o inválida produce BOOKING_DATA_INTEGRITY_ERROR. Conserva clasificación
400/401/403/500/503 del adaptador, sin convertir todo a temporal ni omitir filas.

El nuevo router exige Auth en ambos GET y no ofrece POST. Incluye no-store para
listado/bytes privados. Reutiliza lectura privada y presentación HTTP anteriores;
no modifica las rutas/casos de uso anteriores ni sus pruebas. No importa internos
de Auth/Bookings, no altera migraciones ni dependencias. Sin interfaz nueva:
el DTO permite reutilizar PAGOS-WEB-01 después de integrar sus dependencias.

### Criterios y comprobación prevista

- Denegar contexto ausente/rol/tenant inválidos antes de consultar datos.
- Congelar copia de contexto antes del primer await y no conservarlo entre llamadas.
- Propagar propósito/contexto mínimos; ignorar identidad/cooperativa de body/query.
- Cero válido no se sustituye; relación inválida falla sin lista parcial.
- Mantener códigos seguros y excluir propietario/claves/rutas del DTO HTTP.
- Con Auth/PostgreSQL reales: sesión/roles, dos cooperativas, archivo privado,
  listado, clasificación HTTP, ausencia de POST y cabeceras de caché.
- Ejecutar lint, formato y npm test con base aislada y arranque real; distinguir
  proveedor simulado de pruebas y proveedor de Bookings aún no integrado.

SOLID: caso de uso separado, puerto pequeño e inyectado, composición explícita y
reutilización de adaptador/lector/presentador sin refactorizar módulos ajenos.
Pablo mantiene revisión principal; no se atribuye revisión humana nueva.

### Resultado local de §18

1317 pruebas unitarias y 388 integraciones aprobadas (1705 total), incluidas 20
unitarias y 8 integraciones nuevas. Lint/formato propio aprobados; formato global
fallido en 17 archivos previos. Frontend sin cambios: 144 pruebas aprobadas.
Arranque real: salud 200 y listado sin sesión 401. Diff revisado/comprobado.
[Evidencia, conexión prevista y límites](../evidence/PAGOS-02/2026-11-03-lector-contexto.md)
y [descripción del incremento](../evidence/PAGOS-02/descripcion-pr-lector-contexto.md).
Sin activar el proveedor en producción ni ejecutar Bookings real en las pruebas.
Preparado para el commit local autorizado por Shirley el 3 de noviembre.
Publicación y revisión humana pendientes; no integrada/cerrada.

### Actualización solicitada de PR #55 — 3 de noviembre de 2026

Shirley solicita actualizar #55 y dejarla preparada. Cabeza remota comprobada
ca63a36, Draft y con conflictos. Candidato local feature/PAGOS-02-prepara-55 sobre
develop b4fe717 (PR #51/#60 integradas). Se conserva la spec de develop, incluida
la sección de pantalla, y se incorpora §18 sin borrar antecedentes. No modificar
#56 ni incorporar su script/configuración al diff propio de #55. Sin cambios
funcionales al código publicado del consumidor; proveedor real accesible en base.

Actualizar evidencia/estado/descripción para distinguir PR publicada de candidato
local. Repetir backend lint, formato, npm test y contrato conjunto con Bookings
actual. Frontend sin cambios: ejecutar sus pruebas/lint cuando el entorno lo
permita. Conservar 17 archivos de formato ajenos. No inventar aprobación de Pablo,
CI remoto ni acuerdo de evidencia manual; no marcar integrada/cerrada.
Las reglas Git vigentes prohíben ejecutar merge/push. Preparar el árbol revisable
sin actualizar silenciosamente la cabeza publicada ni crear otra PR sustitutiva.

Resultado del candidato: 1676 unitarias y 524 integraciones aprobadas, 2200 total
y 127 suites, npm test salida 0. Contrato real actual: 12 grupos aprobados.
Frontend 205 y lint aprobados. Backend lint, formato propio y arranque real
aprobados; formato global mantiene 17 archivos ajenos pendientes. No se cambian
pruebas previas, dependencias, migraciones ni los ocho JS originales de #55.
Quedan publicación de la combinación en la rama original, revisión de Pablo y
CI correcto o acuerdo explícito de evidencia manual. No nueva PR sustitutiva.
