# Contrato propuesto de lectura de reservas para Pagos

- **Fecha de conciliación:** 2 de noviembre de 2026, America/Guayaquil.
- **Estado actual:** diseño seleccionado en PR #46 `ad74d25`, con conformidad documental APPROVED de Shirley verificada en GitHub. Adaptador consumidor acotado autorizado por su solicitud de continuación; proveedor, conexión productiva y revisión de implementación pendientes. §12 reemplaza las propuestas incompatibles anteriores.
- **Specs relacionadas:** [PAGOS-01](specs/PAGOS-01.md), [PAGOS-02](specs/PAGOS-02.md) y [BOOK-07](specs/BOOK-07.md). BOOK-07-L05 recibido de Leslie es fuente compartida, no archivo publicado en esta rama.
- **Participantes:** Shirley/Leslie para consumo y provisión; Pablo para contexto de Auth y revisión. Su aceptación de revisar Pagos no aprueba anticipadamente contrato/código.
- **Rama comprobada:** `feature/PAGOS-02-aprobar-comprobante`, HEAD `4e6bbf7`, con cambios locales anteriores conservados.
- **Base remota consultada:** `develop` en `8fdf7e4`, por GitHub, sin incorporarla a esta rama.
- **Alcance autorizado:** continuar preparación/conciliación documental. Leslie pidió confirmar cinco puntos; todavía no recibió por esta redacción aceptación humana de Shirley ni autorizó implementación.

## 1. Resultado del incremento

Una lectura interna de total/plazo persistidos con autorización de propietario o cooperativa. No reserva, recibe comprobantes, vende, libera, expira, modifica precios ni prorroga plazos. El DTO es una fotografía; una escritura posterior revalida estado, vínculos, reloj y concurrencia mediante su propio contrato.

## 2. Fuentes y acuerdos conservados

- [Reglas vigentes](https://github.com/Pato77232/ProyectoBusesUTA/blob/8fdf7e4b9103c40efa6a2ee28e95e3b44c2289a6/docs/business-rules.md) y [acuerdos de primera entrega](https://github.com/Pato77232/ProyectoBusesUTA/blob/8fdf7e4b9103c40efa6a2ee28e95e3b44c2289a6/docs/acuerdos-primera-entrega.md), incluida PR #35.
- BOOK-06-L04 y BOOK-07-L05 completos enviados por Leslie, posteriores a su HEAD reportado `c7ceed9` en `feature/BOOK-03-resumen-creacion-dominio`, sin publicación.
- Nueva «Propuesta de lectura autorizada findForPayment» pegada por el solicitante: firma de dos argumentos, permisos, DTO, errores y 20 escenarios. Es borrador de Leslie; no se inspeccionó su implementación privada.
- Puerto, adaptador simulado, carga, listado, controlador de Payments y API/middleware local de Auth.

Se conservan acreditación antes del total aceptado/pago (verificador, documentos y registro pendientes), recepción–expiración coordinadas, timeout que conserva evidencia, venta idempotente y rechazo justificado. Los 3/15 minutos ya están confirmados; no su evento técnico, rondas o efecto de vencer corrección. Efectivo mediante reserva y sin archivo está confirmado; su contrato técnico continúa pendiente.

## 3. Cambios recomendados frente a la primera propuesta local

Se recomienda usar como base el documento de Leslie con las precisiones de §9. Esta revisión reemplaza las alternativas anteriores para la conciliación, sin convertirla en contrato aprobado.

| Tema | Primera propuesta de Pagos | Recomendación conciliada pendiente de aceptación |
| --- | --- | --- |
| Firma | `findForPayment({ bookingId, context })` | `bookings.paymentQueries.findForPayment({ bookingId, purpose }, authContext)`; consulta y principal separados. |
| Revisión | `REVIEW_PROOF` | `REVIEW_PAYMENT`; junto a `UPLOAD_PROOF`, conjunto cerrado. |
| Identificadores | UUID obligatorio propuesto | Texto opaco no vacío; no nueva restricción UUID ni conversión numérica. La creación actual genera UUID según Leslie, pero el repositorio usa texto. |
| Tiempo | `Date` y nombres propios | ISO UTC con `createdAt`, `expiresAt`, `evaluatedAt`, `proofWindowSeconds`; validar precisión y verdadero inicio del plazo. |
| Total/elegibilidad | `total`, `acceptsPaymentProof` | Público: `totalPriceCents`, `canUploadProof`; adaptar explícitamente en Payments. |
| Recepción aceptada | Campo obligatorio nuevo `acceptedPaymentProof` | Retirarlo de este primer DTO: el esquema/vínculo todavía no está disponible; no inventar `null` ni ausencia de recepción. |
| Comprador | `ownerId` solo para carga | Mantener esa minimización: omitirlo en `REVIEW_PAYMENT`, cuyo listado no lo necesita. |
| Errores | Varios errores traducidos a 503 | 401/403/400; 503 solo temporal; integridad 500. No toda excepción es transitoria. |

## 4. Firma y contexto propuestos

```javascript
bookings.paymentQueries.findForPayment(
  { bookingId, purpose },
  authContext,
)
```

- `bookingId`: texto opaco no vacío, sin confundirlo con viaje/comprobante ni convertirlo a número.
- `purpose`: `UPLOAD_PROOF` o `REVIEW_PAYMENT`, fijado por el caso de uso del servidor.
- Rechazar campos extra de consulta: actor, propietario, cooperativa, precio, estado o reloj no son autoridad elegida por el cliente.
- `authContext`: principal por solicitud ya autenticado por Auth, procedente de composición confiable. No reconstruirlo desde body/query/metadatos de comprobante.
- El adaptador proyecta los datos mínimos; dominio/aplicación no reciben req/res ni importan internals de Auth.

Pablo confirmó el origen en su respuesta humana del 2 de noviembre: `auth.authenticate`, obtenido de `createAuthModule`, asigna `request.auth = { user, sid }` tras comprobar token y sesión persistida, revocación, vencimiento y coincidencia de rol/cooperativa con la identidad actual. Cada nueva solicitud vuelve a autenticarse; esa comprobación no garantiza autorización permanente ni impide una revocación durante la operación.

Su proyección concreta sigue propuesta para conciliar con Leslie, sin adaptador público ya implementado:

```javascript
const authContext = {
  userId: request.auth.user.id,
  role: request.auth.user.role,
  cooperativeId: request.auth.user.cooperative_id,
};
```

Se proyectará en la frontera HTTP y no incluirá email, sid, token o cookie. La confianza procede del flujo interno autenticado, no de las propiedades de un objeto. No se acepta del body ni se pasa req/res al dominio/aplicación. Esta redacción no cambia código ni afirma aprobación de Leslie.

No guardar el principal como credencial de un trabajador durable ni usarlo fuera de su solicitud. Reintentos autenticados deben comprobar vigencia mediante Auth. Un trabajador sin sesión necesita un contrato de servicio separado. Invitado tampoco se sustituye por CUSTOMER/CLERK ficticio.

## 5. Matriz de permisos confirmada por Pablo; cierre conjunto pendiente

| Principal verificado | Propósito | Filtro del proveedor | Resultado |
| --- | --- | --- | --- |
| CUSTOMER con cooperativa nula | `UPLOAD_PROOF` | ID y propietario igual al usuario verificado; tenant obtenido de la reserva. | DTO propio o `null`. |
| CLERK con cooperativa válida | `REVIEW_PAYMENT` | ID y tenant en la consulta de Bookings, con la cooperativa de la identidad. | DTO del tenant o `null`. |
| CUSTOMER para revisión o CLERK para carga | Incompatible | No consultar repositorio. | `FORBIDDEN`; no habilita caja. |
| COOPERATIVE_ADMIN o SYSTEM_ADMIN | Cualquiera | No consultar repositorio. | `FORBIDDEN`; sin permisos implícitos. |
| Sin principal/sesión válida | Cualquiera | No consultar repositorio. | `UNAUTHENTICATED`. |
| CLERK sin tenant o CUSTOMER con tenant | Cualquiera | No consultar repositorio. | `FORBIDDEN` por contexto inconsistente. |
| Invitado o trabajador sin contrato específico | Cualquiera | No suplantar un rol permitido. | Fuera del incremento; denegar sin consulta global. |

Si el método actual de Bookings exige tenant para buscar al comprador, añadir dentro de Bookings una lectura por ID/propietario; no pedir al cliente cooperativa para satisfacer ese método. Pagos conserva controles de propiedad/tenant como defensa adicional. Reserva ajena e inexistente devuelven el mismo `null`.

## 6. Respuesta propuesta

`Promise<BookingForPayment | null>`. DTO inmutable, sin JSONB completo, pasajeros, cédulas, acreditaciones, archivos, URLs privadas, cookies, tokens, sid, repositorios o SQL.

| Campo | Tipo/origen | Uso y restricción |
| --- | --- | --- |
| `bookingId` | Texto persistido | Correlación con reserva autorizada. |
| `ownerId` | ID opaco persistido | Para la comprobación defensiva de carga. Propuesta: solo `UPLOAD_PROOF`; omitir al CLERK. |
| `cooperativeId` | Texto persistido | Tenant real, no elegido por comprador. |
| `status` | Estado persistido soportado | Informativo; no equivale a pago aprobado ni cambia al leer. |
| `createdAt` | ISO UTC persistido | Inicio original solo si coincide exactamente con el inicio contractual del plazo (§9). |
| `proofWindowSeconds` | Entero 180..300 | Derivado de fechas coherentes con la misma precisión, no configuración viva. |
| `expiresAt` | ISO UTC persistido | Vencimiento original, sin prórroga. |
| `totalPriceCents` | Entero seguro no negativo persistido | Total definitivo aceptado/congelado, no dinero transferido. Cero explícito no sustituye un dato ausente. |
| `currency` | `USD` validado contra reserva/resumen | No asumir USD para moneda ausente o discordante. |
| `evaluatedAt` | ISO UTC del reloj confiable de Reservas | Momento de evaluación, no aportado por navegador ni reloj elegido en Payments. |
| `canUploadProof` | Booleano calculado con datos suficientes | Elegibilidad inicial informativa; no aceptación transaccional, reemplazo o aprobación. |

Derivar `proofWindowSeconds = (expiresAt - createdAt) / 1000` solo si `createdAt` es realmente el inicio contractual y la precisión permite obtener un entero 180..300. No redondear para ocultar inconsistencias ni recalcular desde configuración viva. Si la garantía no existe, acordar dato persistido de inicio o nuevo incremento; no editar migraciones existentes.

`canUploadProof` es true solo con estado soportado elegible, ausencia comprobable de recepción aceptada y `evaluatedAt < expiresAt`. En igualdad o después es false y se conserva lectura de la reserva autorizada. Un estado legítimo no elegible puede dar false; un dato/estado ausente o corrupto no se convierte en false.

Leslie reporta únicamente PENDING_PAYMENT y ausencia del vínculo/estados de recepción en el esquema actual. No se da por resuelta la comprobación de ausencia de recepción: §9 debe delimitar qué puede probar con persistencia real. La primera implementación no inventará revisión, venta ni recepción que ese modelo no representa.

La lectura no mantiene bloqueos durante una carga posterior ni usa SELECT FOR UPDATE como autorización futura. La mutación de recepción volverá a evaluar reloj/estado bajo su coordinación transaccional cuando su API tenga contrato propio.

## 7. Ausencia y errores propuestos

La API interna entrega DTO o `null`; las interfaces consumidoras traducen al formato de errores vigente. Los códigos/clases finales se confirman antes de tocar middleware compartido.

| Situación | Resultado interno | Traducción propuesta |
| --- | --- | --- |
| Reserva inexistente o ajena | `null` indistinguible | 404 genérico en carga/consulta individual. |
| Sin autenticación válida | `UNAUTHENTICATED` | 401, sin consulta. |
| Rol/propósito prohibido o identidad inconsistente | `FORBIDDEN` | 403, sin consulta global. |
| Consulta malformada/campos extra/propósito desconocido | `BookingValidationError`; propuesta de Pablo: `BOOKING_VALIDATION_ERROR` | 400 mediante traducción acordada en consumidor. |
| Reserva propia no elegible por estado/plazo conocido | DTO con `canUploadProof: false` | Lectura exitosa; la escritura decide su conflicto. |
| Fallo temporal técnico clasificado | `BOOKING_QUERY_UNAVAILABLE`, código nuevo propuesto por Pablo | 503 controlado; no ausencia, cero o datos inventados. |
| Total, moneda, fechas o estado persistido inválidos | `BOOKING_DATA_INTEGRITY_ERROR`, código nuevo propuesto por Pablo | 500 genérico; no cotización falsa ni carga habilitada. |
| Excepción no clasificada | `INTERNAL_ERROR`, mecanismo existente | 500 genérico, sin presumir temporalidad ni exponer SQL. |

Pablo confirmó la matriz de permisos y propuso esta traducción: ausencia/ajena se convierte en `404 BOOKING_NOT_FOUND`, autenticación inválida en `401 UNAUTHENTICATED` por Auth existente y rol/propósito prohibido en `403 FORBIDDEN`. El `BookingValidationError` actual no tiene httpStatus; propagarlo directamente no garantiza 400. Se acordará un adaptador consumidor sin importar clases internas de Bookings ni AuthError privado. El middleware global ya admite errores controlados con code/httpStatus y mensaje seguro; no se modifica unilateralmente. Los códigos nuevos, clases y pruebas continúan en conciliación con Leslie.

En bandeja, una reserva que devuelve `null` para un comprobante del tenant no se omite silenciosamente. Es una inconsistencia de relación/autorización a clasificar con resultado genérico al usuario. El catch actual convierte toda excepción a total no disponible: debe adaptarse para preservar 401/403, integridad 500 y temporal 503, no mapear todo a 503.

## 8. Veinte escenarios de Leslie conciliados

B1/U1/T1 son etiquetas sintéticas, no identificadores reales ni pruebas ejecutadas. Ejemplo: reserva de U1 en T1, 875 centavos USD, inicio `2026-11-02T14:00:00.000Z`, vencimiento `14:05:00.000Z`.

| Caso | Condición | Resultado propuesto |
| --- | --- | --- |
| F01 | U1 CUSTOMER carga a 14:04:59.999Z; elegible y sin recepción aceptada comprobada. | DTO, total 875, tenant T1, elegibilidad true. |
| F02 | U2 CUSTOMER consulta B1. | `null`, sin datos de U1/T1. |
| F03 | U1 consulta reserva inexistente. | Mismo `null` que F02. |
| F04 | CLERK T1 revisa B1. | DTO y total; propuesta de omitir `ownerId`. |
| F05 | CLERK T2 revisa B1. | `null`. |
| F06 | CUSTOMER pide revisión; variante CLERK pide carga. | `FORBIDDEN` antes de base. |
| F07 | COOPERATIVE_ADMIN; variante SYSTEM_ADMIN. | `FORBIDDEN` antes de base. |
| F08 | Sin principal/sesión; variante trabajador sin contrato propio. | Denegar sin consulta ni identidad fabricada. |
| F09 | U1 lee exactamente a 14:05:00.000Z. | DTO, elegibilidad false, sin expirar/liberar. |
| F10 | U1 lee a 14:05:00.001Z. | Igual, sin borrar/liberar. |
| F11 | CLERK lee reserva en revisión con recepción aceptada, después del plazo. | Futuro tras L-04: DTO legible, elegibilidad inicial false. No ejecutable con el esquema actual solo PENDING_PAYMENT. |
| F12 | Consulta agrega tenant, propietario, importe u otro campo. | Propuesta `BOOKING_VALIDATION_ERROR`, no usarlos como autoridad; código final pendiente. |
| F13 | La base no responde. | Error técnico clasificado; nunca ausencia o total cero. |
| F14 | Total nulo/fraccionario, moneda discordante; variantes fecha/duración/estado corruptos. | Error de integridad sin datos inventados. |
| F15 | Configuración cambia de 300 a 180 tras persistir B1. | Plazo 300 y vencimiento originales. |
| F16 | Cambia tarifa de otra hoja. | Total persistido 875, sin recotizar. |
| F17 | Lectura true y después vence antes de recepción. | Decide la mutación coordinada; no garantía por lectura. |
| F18 | Se repite F01 al llegar al límite. | Puede devolver false; sin prórroga/escrituras. |
| F19 | Invitado presenta solo ID/cédula. | No autorizar ni suplantar CUSTOMER. |
| F20 | CLERK sin tenant o CUSTOMER con tenant. | `FORBIDDEN`, sin consulta global. |

Son 20 grupos con variantes; F11 depende del contrato/persistencia de recepción y no se contará aprobado para un lector que solo soporte PENDING_PAYMENT. Al autorizar código, comprobarlos con dobles de Payments y PostgreSQL aislado en Bookings según el alcance realmente soportado.

## 9. Cinco puntos para cerrar con Leslie y Pablo

> Fotografía de la conciliación anterior. Sus preguntas genéricas de diseño quedan reemplazadas por la decisión publicada en §12; no volver a pedir aceptación de firma/contexto/errores/inicio explícito. Sigue pendiente acreditar implementación y datos del proveedor, no inventarlos por la aprobación documental.

Esta tabla es la recomendación concreta del lado consumidor para enviar. No registra aprobación humana de Shirley por redactarla.

| Punto | Recomendación | Confirmación pendiente |
| --- | --- | --- |
| 1. Firma | Usar dos argumentos de Leslie, propósitos cerrados e IDs opacos, sin nueva restricción UUID ni campos extra. | Leslie/Shirley confirman firma en ambos lados. |
| 2. Permisos/contexto | Matriz de §5 y principal de la solicitud verificada; proyección propuesta `{ userId, role, cooperativeId }`, sin req/res, body o trabajadores/invitados implícitos. | Pablo confirmó origen, autenticación por solicitud y matriz. Conciliar proyección/consumo con Leslie; no existe adaptador público implementado. |
| 3. Respuesta | Nombres/ISO de Leslie, mapeo explícito del DTO interno de Payments; `ownerId` solo en carga; sin campo nuevo de recepción. | Leslie confirma omitir `ownerId` al CLERK y que `createdAt` es el inicio exacto/coherente del plazo. |
| 4. Errores | `null` uniforme; códigos concretos propuestos por Pablo en §7, con traducción en consumidor sin importar clases privadas. | Propuesta de Pablo recibida; Leslie/Shirley deben cerrar códigos y traducción antes de implementar. No se amplía el middleware común. |
| 5. Estados/pruebas | Delimitar primero PENDING_PAYMENT y campos comprobables. No inventar ausencia de recepción; F11 espera L-04. | Leslie indica cómo prueba ausencia de recepción aceptada. Si no puede, ajustar alcance o resolver persistencia en otro incremento autorizado antes de habilitar `canUploadProof`. |

Responder con aceptación o el campo/resultado exacto que cambia. Cerrar lectura no aprueba recepción, venta, liberación, correcciones, efectivo ni invitado.

## 10. Adaptación prevista y pendientes siguientes

El puerto actual sigue siendo `findForPayment(bookingId)` y el proveedor de Reservas es simulado. Carga consume `ownerId`, `total`, `expiresAt`, `acceptsPaymentProof`; listado consume `total`/tenant. La función de fechas de Payments ya admite ISO y Date.

Tras aprobar contrato y autorizar código:

1. Controlador transmite contexto autenticado a carga/listado; ambos fijan propósito y llaman el puerto con contexto. No existe sobrecarga antigua sin autorización.
2. Un adaptador usa solo `bookings.paymentQueries`. Si se conserva el DTO interno, mapea en un único lugar `totalPriceCents` a `total` y `canUploadProof` a `acceptsPaymentProof`; no altera el contrato público unilateralmente.
3. Adaptar clasificación de errores y validar USD antes de mostrar moneda. Actualizar pruebas de carga, listado, puertos y controlador sin debilitar expectativas.
4. Leslie implementa su proveedor según su spec/autorización; verificar contrato real con PostgreSQL aislado, lint/formato/pruebas. Si cambia composición, comprobar arranque real.

Pendientes registrados para una sola consulta conjunta, sin exigir resolver toda la plataforma para cerrar este lector:

- **Acreditación:** verificador, documentos/evidencia, registro y acceso privado; ya confirmado antes del total aceptado/pago.
- **Mutaciones:** firmas/contextos de recepción, venta y liberación; versiones, bloqueo de reemplazos, importe observado/moneda/actor, justificación y recuperación durable después de timeout o fallo local.
- **Correcciones:** evento técnico de primera carga y solicitud, rondas, correo fallido/tardío y efecto de vencer 15 minutos. No está aprobada la propuesta de cerrar edición y mantener revisión/asientos al vencer.
- **Caja:** plazo, titularidad, confirmación de efectivo, abandono/cancelación e idempotencia; reserva y ausencia de archivo de depósito ya confirmados.
- **Auth/correo:** contexto de compra invitada con vencimiento/revocación/reenvío/CSRF; proveedor de avisos, deduplicación, errores, límites de reintentos y evidencia de entrega. Son propuestas, no integración disponible.
- **Formatos:** Pablo confirmó que PDF/JPEG/PNG y máximo 5 MiB quedaron ratificados; se exige validar contenido, extensión y MIME. No se vuelve a pedir esa ratificación ni se afirma validación implementada por registrarla.

## 11. Evidencia y límites

- SHA-256 de los primeros adjuntos: BOOK-06-L04 `4340F6DD579988A92CE841E55F83824FD33B6F141AFDBC70C1143A251F7E4A6D`; BOOK-07-L05 `B66BCB2A21F2F4008DF82FDFEFE5A66A3EA4987B6EC73174DDEC4F35E1CE19CD`. La nueva propuesta de 20 casos llegó como texto pegado, no como commit consultado.
- Las confirmaciones humanas se conservan; propuestas no pasan a Acordada por su redacción. Los borradores posteriores a c7ceed9 no se atribuyen a ese commit.
- Se comprobó que el código consumidor requiere adaptar nombres, contexto y errores; no se modificó ni se afirmó integración.
- Verificación de esta revisión documental: diff/enlaces y comparación del contenido backend antes/después; resultados en [estado-proyecto](estado-proyecto.md). No se ejecutaron suites funcionales.
- Los 20 escenarios son futuros; el lector no se declara aprobado/implementado. La actividad del día 1, revisión humana e integración siguen pendientes.

### Respuesta humana de Pablo — 2 de noviembre

- Fuente: adjunto completo recibido por Shirley, SHA-256 `37CCF1AC7135AB26F82871FF2EB389F99AFB5A5D575357927B75F63A66072D3C`. Pablo declara contraste con develop `8fdf7e4`; esa rama se volvió a comprobar por GitHub, sin incorporarla.
- Confirmado: origen Auth, matriz y ratificación de formatos. Propuestos: proyección exacta, códigos nuevos y operación durable autorizada; no son APIs ya disponibles ni aprobación de Leslie.
- Borradores locales reportados, no inspeccionados/publicados: AUTH-INVITADO-01, CORREO-01 y AUTH-06. No hay proveedor/API de correo ni endpoint CLERK disponible. No duplicar esas tareas; esperar sus specs publicadas para revisión.
- El lector sigue esperando definición de inicio/DTO/estados y ausencia comprobable de recepción con Leslie. No se inventa relación compra–reserva para invitados, autorización de trabajadores o inicio de corrección ante un correo fallido/tardío.

## 12. Decisión publicada y siguiente incremento consumidor

### Decisión: adoptar el lector seleccionado en PR #46

- **Estado:** diseño seleccionado por delegación reportada por Pablo; conformidad documental de Shirley APPROVED sobre `ad74d25` comprobada el 2 de noviembre. No acredita proveedor o código aprobados.
- **Fuente y participantes:** [contrato publicado](https://github.com/Pato77232/ProyectoBusesUTA/blob/ad74d25eae8163094a287a2d4b854ddb04b036c6/docs/contratos/lectura-reservas-pagos.md), [PR #46](https://github.com/Pato77232/ProyectoBusesUTA/pull/46) y revisión de `shirley6126`. Pablo registra delegación reportada; no se atribuye una verificación individual de datos a Leslie. Shirley pidió continuar el consumidor en esta sesión.
- **Specs y reglas afectadas:** PAGOS-01/02, BOOK-07-L05 reportada por Leslie; RN-02 y RN-50–54. Mantener módulos separados y API pública.
- **Decisión:** firma `findForPayment({ bookingId, purpose }, authContext)`, propósitos de servidor UPLOAD_PROOF/REVIEW_PAYMENT, contexto mínimo `{ userId, role, cooperativeId }`; matriz y códigos explícitos del documento publicado. No hay función pública de Auth que ya produzca esta proyección ni compatibilidad nueva sin contexto.
- **Tiempo:** `createdAt` conserva significado de creación. El inicio es `proofWindowStartedAt`, persistido junto a duración efectiva entera 180..300 y `expiresAt`. Las fechas son ISO UTC con milisegundos coherentes. No se deriva duración desde `createdAt` ni se recalcula por configuración viva.
- **Recepción:** Bookings acredita persistencia de primera recepción aceptada/instante y la ausencia real de ella. Campos no implementados o históricos desconocidos no se vuelven ausencia mediante defaults. El DTO no entrega esos campos privados: el consumidor no inventa pruebas de recepción a partir de `canUploadProof`.
- **Errores:** se conservan los códigos seleccionados en el documento publicado. El consumidor mapea errores públicos a errores propios seguros; no importa clases internas ni modifica el middleware global. Null en lectura individual sigue ausencia/ajena; al conectar la bandeja, una relación que debería existir será integridad 500.
- **Responsables y revisión:** Leslie prepara proveedor/persistencia; Shirley prepara consumidor; Pablo revisa contrato/Auth y aceptó revisar PAGOS-02. Revisión complementaria de Leslie propuesta para compatibilidad de Bookings, no asignada como segunda aprobación obligatoria.
- **Criterios:** F01/F15 verifican inicio explícito y duración persistida; F11 espera recepción soportada. Estados futuros se enumeran en Bookings. No contar pruebas reales de ambos módulos por usar dobles del consumidor.
- **Trabajo dependiente e independiente:** se implementa únicamente el adaptador consumidor y sus errores/pruebas según PAGOS-02 §17, sin conexión a rutas/composición. Integración exige proveedor publicado y su evidencia. Mutaciones, correcciones, caja, correo e invitado mantienen contratos separados.
- **Decisión anterior reemplazada:** preguntas genéricas de §9 y cálculo del plazo desde createdAt de §6. Las secciones anteriores conservan la historia de propuestas; esta sección es el estado actual.

Comprobación remota de esta continuación: develop `3d053a4`, con PR #45 integrada; PR #46 aprobada documentalmente, todavía abierta al consultarla. No se incorporaron esas bases a la rama local ni se reescribieron documentos ajenos. La autorización del adaptador no permite implementar Bookings ni afirmar persistencia o venta productiva.
