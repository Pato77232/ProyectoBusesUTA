# Propuesta de lectura autorizada findForPayment

> Actualización vigente del 2 de noviembre: el diseño publicado en PR #46 reemplaza las propuestas locales incompatibles, incluida la omisión de canUploadProof y el uso exclusivo de createdAt como inicio. Ver [conciliación actual](reservas-pagos-conciliacion-20261102.md), puntos 1–2. Los apartados anteriores conservan historia; no son el contrato de destino.

Fecha: 2 de noviembre de 2026. Complementa [BOOK-07-L05](specs/BOOK-07-L05.md).
Responsable de preparación: Leslie Coello, con asistencia de Codex.
Estado: borrador para conciliación con Shirley. El usuario autoriza preparar el contrato; no implementarlo. Ninguna firma, campo o código de error nuevo de este documento se considera aprobado por su redacción.

## 1. Resultado del incremento

Una lectura interna de Bookings para que Payments obtenga el total y plazo persistidos únicamente cuando el comprador sea dueño de la reserva o un oficinista opere dentro de su cooperativa y propósito autorizado.

No crea reserva, no acepta comprobante, no aprueba pago, no libera asientos ni expira. No importa tablas o repositorios ajenos ni entrega el repositorio de Bookings al consumidor.

## 2. Evidencia y compatibilidad

Rama local de Leslie: feature/BOOK-03-resumen-creacion-dominio, HEAD c7ceed9, borradores posteriores sin commit. bookings/index.js todavía devuelve router sin esta API. La persistencia local tiene bookings, summary JSONB, owner_id, cooperative_id, created_at, expires_at y total_price_cents. El estado actual solo admite PENDING_PAYMENT.

El puerto actual de Shirley es findForPayment(bookingId). El contrato de esta propuesta agrega propósito y contexto: es cambio explícito para acordar, no adaptación ya disponible. No habilitar la firma antigua sin contexto por compatibilidad. No se verificó la rama privada de Shirley ni se repitieron sus pruebas.

## 3. Firma pública propuesta

```js
bookings.paymentQueries.findForPayment(
  { bookingId, purpose },
  authContext
)
```

Propuesta de propósitos cerrados: UPLOAD_PROOF y REVIEW_PAYMENT. No añadir SERVICE, ADMIN o GUEST implícitos.

- bookingId: identificador opaco de reserva, texto no vacío; no convertir a número ni confundir con tripId/paymentProofId. La creación actual genera UUID, pero el repositorio usa texto. Acordar con Shirley si se restringirá el contrato público a UUID sin romper identificadores previos; no imponer esa restricción silenciosamente aquí.
- purpose: uno de los dos valores propuestos. Rechazar campos extra en el objeto de consulta.
- authContext: principal/sesión cuya autenticación verificó el servidor mediante Auth. No viene del body, query o metadatos arbitrarios del comprobante.
- No cooperativeId, ownerId, total, estado ni reloj elegidos por el comprador en el primer objeto.
- El puerto de identidad/adaptador convierte el contexto autenticado en datos mínimos verificados; dominio/aplicación no reciben req/res ni importan internals de Auth.

La existencia de propiedades sid/user/role en un objeto no prueba autenticidad. La frontera de confianza es la composición de servidor y Auth que lo entrega. Reusar el contexto ya verificado de la solicitud y rechazar llamadas sin él; no fabricar un principal desde campos serializados del cliente. La forma exacta del contexto/adaptador y verificación de vigencia en reintentos debe acordarse antes de implementar.

## 4. Matriz de permisos propuesta

| Contexto verificado | Propósito | Filtro de lectura | Resultado |
| --- | --- | --- | --- |
| CUSTOMER, cooperative_id null | UPLOAD_PROOF | id de reserva y owner_id igual al usuario verificado | DTO si existe y es propia; null si no existe o es ajena |
| CLERK, cooperative_id válido | REVIEW_PAYMENT | id de reserva y cooperative_id igual a la identidad verificada | DTO de esa cooperativa o null |
| CUSTOMER | REVIEW_PAYMENT | No consultar repositorio | FORBIDDEN |
| CLERK | UPLOAD_PROOF | No consultar repositorio | FORBIDDEN; caja no se habilita por esta lectura |
| COOPERATIVE_ADMIN o SYSTEM_ADMIN | Cualquiera | No consultar repositorio | FORBIDDEN, sin permiso implícito para revisar comprobantes |
| Principal ausente o sesión inválida | Cualquiera | No consultar repositorio | UNAUTHENTICATED |
| CLERK sin cooperativa o CUSTOMER con cooperativa | Cualquiera | No consultar repositorio | Denegar contexto inconsistente; no fallback global |
| Invitado o trabajador de fondo sin sesión | Cualquiera | No consultar repositorio | Fuera del incremento; no suplantar CUSTOMER/CLERK |

Para CUSTOMER no se exige elegir la cooperativa: se autoriza por owner_id y se obtiene el tenant de esa reserva. La consulta actual findByOwner exige cooperativeId; no obtenerlo del comprador para satisfacer ese método. Proponer una lectura específica filtrada por id/propietario, implementada dentro de Bookings.

Para CLERK usar filtro tenant en la consulta SQL de Bookings. Comparar después contra resultado como defensa adicional; no leer globalmente para luego filtrar en Payments. Una lectura con permiso para revisar no constituye autorización de venta.

## 5. Respuesta mínima propuesta

DTO inmutable, sin estructura JSONB interna ni detalles de infraestructura:

| Campo | Tipo/origen | Uso |
| --- | --- | --- |
| bookingId | Texto persistido | Correlación |
| ownerId | ID opaco persistido | Compatibilidad con comparación de propiedad del consumidor actual; la API ya autoriza antes de responder |
| cooperativeId | Texto persistido | Tenant confiable de la reserva |
| status | Estado persistido | Mostrar estado; no traducir como pago aprobado |
| createdAt | ISO UTC persistido | Inicio original, sin reiniciar |
| proofWindowSeconds | Entero 180..300 derivado de fechas persistidas coherentes | Compatibilidad con el lector de pagos; no leer configuración viva para reservas previas |
| expiresAt | ISO UTC persistido | Fecha límite original |
| totalPriceCents | Entero seguro no negativo de la reserva | Total aceptado/congelado, nunca tarifa actual |
| currency | USD validado contra resumen persistido | No asumir USD para un registro con moneda ausente/discordante |
| evaluatedAt | ISO UTC de reloj confiable del servidor al evaluar la lectura | Interpretar canUploadProof; no lo aporta el navegador |
| canUploadProof | Booleano derivado de estado y plazo coherentes | Elegibilidad informativa para recepción inicial, no autorización definitiva de carga |

ownerId es un identificador mínimo, no nombres/cédulas/contactos. Si Payments deja de requerirlo al delegar totalmente la autorización, acordar omitirlo en vez de ampliar datos innecesarios. No devolver pasajeros, nacimiento, discapacidad, documentos de acreditación, resumen completo, claves de creación, archivos, URLs privadas, cookies o tokens.

proofWindowSeconds se obtiene de expiresAt - createdAt, validando duración entera 180..300. No extender expiresAt ni recalcularlo desde la configuración actual. El total se lee del registro de reserva y se valida su coherencia/seguridad; un dato nulo o corrupto es error, no cero.

### canUploadProof y estados

Regla propuesta para carga inicial: true solo si el estado persistido permite recepción inicial, no consta recepción ya aceptada y evaluatedAt < expiresAt. En igualdad o después devuelve false. Para estado no elegible, false; no oculta la reserva al propietario autorizado.

No confundir permiso inicial con reemplazo de una versión, reapertura de corrección o aprobación. Si está en revisión, canUploadProof inicial es false, pero leer total/plazo sigue permitido para REVIEW_PAYMENT incluso después del plazo original.

Los nombres/esquema de estados futuros y vínculo de recepción siguen pendientes en L-04/L-05. No publicar una lectura que invente esa información. Si el proveedor no puede comprobar los datos necesarios, debe producir error explícito. El primer incremento debe delimitar con Shirley los estados realmente soportados; no devolver false como sustituto de datos ausentes ni declarar reservas vendidas con el esquema actual.

## 6. Ausencia y errores propuestos

La API interna devuelve DTO o null para ausencia/ajena dentro del contexto autorizado; errores para entradas/autorización/infraestructura. El consumidor HTTP traduce sin filtrar detalles:

| Situación | Resultado interno propuesto | Traducción HTTP sugerida en consumidor |
| --- | --- | --- |
| Reserva inexistente | null | 404 genérico |
| Comprador ajeno o CLERK de otra cooperativa | null idéntico | Mismo 404 genérico; sin metadatos |
| Sin autenticación válida | Error UNAUTHENTICATED | 401 |
| Rol/propósito prohibido o identidad inconsistente | Error FORBIDDEN | 403 |
| Consulta malformada/campo extra/propósito desconocido | BookingValidationError, VALIDATION_ERROR | 400 |
| Reserva propia no elegible por estado/plazo | DTO, canUploadProof false | Lectura exitosa; la mutación decide su propio conflicto |
| Caída temporal de base/proveedor | Error técnico propagado; adaptador clasifica temporal sin exponer SQL | 503 cuando sea temporal según middleware acordado; nunca null |
| Total/moneda/fecha/estado persistido inválido | Error de integridad controlado | 500 genérico, sin falsa cotización ni carga habilitada |

No todos los errores técnicos son transitorios. No convertir cualquier excepción a 503 ni exponer mensajes SQL. Los códigos nuevos/clases y su traducción final necesitan confirmación; esta tabla no modifica el middleware común.

## 7. Repetición, carreras y efectos

Es solo lectura, sin Idempotency-Key ni estado del intento. Repetir no escribe ni prorroga; puede devolver un estado/canUploadProof más reciente por paso del tiempo u otra transacción, no está obligada a devolver bytes idénticos.

Un true no bloquea inventario ni garantiza recepción futura: entre leer y notificar puede vencer el plazo. markPaymentProofReceived debe revalidar con el bloqueo/reloj transaccional acordados. Esta lectura no crea bloqueo duradero que abarque carga de archivos o revisión.

No usar SELECT FOR UPDATE como permiso reservado para una solicitud posterior. Usar una lectura coherente para el DTO, reloj explícito y filtro autorizado. No llamar a tarea de expiración ni cambiar PENDING_PAYMENT a vencida como efecto de leer.

Un reintento desde trabajador durable de Payments necesita contrato de servicio/autorización propio, sin token guardado improvisadamente ni bypass tenant. Se mantiene expresamente fuera de este primer contrato; no rompe la recuperación ya acordada de mutaciones, que tendrá su propia entrada autorizada.

## 8. Ejemplos sintéticos

Reserva B1, propietario U1, cooperativa T1, estado PENDING_PAYMENT, createdAt 2026-11-02T14:00:00.000Z, expiresAt 2026-11-02T14:05:00.000Z, total 875 centavos, moneda USD. B1/U1/T1 son etiquetas de ejemplo, no identificadores reales ni propuestas de UUID inválidos para producción.

| Caso | Contexto y consulta | Reloj/condición | Esperado |
| --- | --- | --- | --- |
| F01 | U1 CUSTOMER, B1, UPLOAD_PROOF | 14:04:59.999Z; elegible y sin recepción aceptada | DTO, canUploadProof true, total 875 y tenant T1 |
| F02 | U2 CUSTOMER, B1, UPLOAD_PROOF | Igual | null; sin datos de U1/T1 |
| F03 | U1 CUSTOMER, reserva ausente | Igual | null indistinguible de F02 |
| F04 | CLERK T1, B1, REVIEW_PAYMENT | Igual | DTO, total 875 |
| F05 | CLERK T2, B1, REVIEW_PAYMENT | Igual | null |
| F06 | U1 CUSTOMER, B1, REVIEW_PAYMENT | Cualquiera | FORBIDDEN antes de base |
| F07 | COOPERATIVE_ADMIN T1, B1, REVIEW_PAYMENT | Cualquiera | FORBIDDEN antes de base |
| F08 | Sin principal verificado | Cualquiera | UNAUTHENTICATED antes de base |
| F09 | U1 CUSTOMER, B1, UPLOAD_PROOF | Exactamente 14:05:00.000Z | DTO, canUploadProof false; estado/ocupaciones no cambian |
| F10 | U1 CUSTOMER, B1, UPLOAD_PROOF | 14:05:00.001Z | Igual elegibilidad false, sin liberar ni borrar |
| F11 | CLERK T1 consulta reserva con recepción aceptada en revisión | Después del plazo inicial | DTO legible y canUploadProof inicial false; no expiración por lectura. Estado futuro condicionado a L-04 |
| F12 | Consulta agrega cooperativeId T2, ownerId, total u otro campo | Antes de base | VALIDATION_ERROR; no usa esos valores como autoridad |
| F13 | Base no responde | Identidad válida | Error técnico; nunca null ni DTO con total cero |
| F14 | Registro total null/fraccionario o moneda discordante | Identidad válida | Error controlado; no datos inventados |
| F15 | Configuración global pasa de 300 a 180 segundos | B1 ya persistida | B1 conserva vencimiento y proofWindowSeconds 300 |
| F16 | Nueva tarifa de otra hoja después de crear B1 | B1 persistida | total 875, no recotización |
| F17 | Lectura true y luego vence antes de recepción | Mutación posterior | Lectura no garantiza éxito; decide operación de recepción coordinada |
| F18 | Se repite lectura después de F01 | Ahora en límite | canUploadProof false sin prórroga ni doble efecto |
| F19 | Invitado presenta solo B1/cédula | Sin contrato Auth | No autorizar como propietario ni consultar por ese conocimiento |
| F20 | CLERK sin tenant o CUSTOMER con tenant | Contexto inconsistente | FORBIDDEN, sin consulta global |

Para ejemplo monetario autorizado no se invoca pasajero-quote histórico: 875 procede de la reserva persistida. Nunca se imprime ownerId o tenant en errores de acceso cruzado.

## 9. Archivos previsibles del incremento futuro

- domain: contrato de lectura/DTO y errores mínimos, sin Auth concreto, pg o Express.
- application: caso de uso de lectura con puerto de identidad, repositorio y reloj.
- infrastructure: resolver principal autorizado y consulta específica de Bookings por dueño/tenant; no dar SQL a Payments.
- index.js: exponer paymentQueries y componer dependencias.
- tests/unit/bookings: matriz de permisos, shape/privacidad, plazos, corrupción y errores.
- tests/integration/bookings: PostgreSQL real, propiedad/tenant cruzados, lectura sin escrituras y persistencia de total/plazo.
- Composición y consumidor de Payments: adaptación explícita del puerto tras acuerdo; no cambios a la rama privada de Shirley desde esta sesión.

No migración esperada para la lectura de datos ya existentes; si los estados/vínculos necesarios requieren ampliación, delimitar nueva migración y otro incremento antes de implementarla. No introducir escrituras “solo para poder consultar”.

## 10. Verificación prevista y puertas de aprobación

Los 20 ejemplos son escenarios futuros, no pruebas ejecutadas. Para autorizar implementación Shirley/Leslie deben confirmar: firma/dos propósitos, contexto verificado, null frente a error, necesidad de ownerId/otros campos, cálculo temporal, estados soportados y forma de adaptar su puerto actual.

Después implementar un único comportamiento de lectura con unitarias y PostgreSQL aislado, siguiendo testing-database.md; ejecutar desde backend lint, format:check y npm test. Si cambia composición, verificar arranque real además de la app montada. Sin dependencias nuevas previstas; sin pantalla ni cambios en DESIGN.md.

Pendientes fuera de este incremento conservados: acreditador/evidencias; protocolo de versiones, importe observado y diferencias; recepción transaccional, venta/liberación e idempotencia de mutaciones; correcciones/caja e invitado. Confirmar este lector no autoriza esas operaciones.

## 11. Evidencia de preparación

Autorización de Leslie en este chat: preparar propuesta mientras Shirley responde. Se leyó L-05, identidad local, caso de consulta de intento, repositorio/migración existentes, API de Auth y reglas del proyecto. Solo documentación. No se ejecutaron suites de producto ni se cambió código, esquema, pruebas, dependencias, rama o HEAD. No commits, push, merge, rebase ni tags. Propuesta para revisión humana, sin aprobación ni integración.

## 12. Conciliación posterior con Shirley — alcance base propuesto, 2 de noviembre de 2026

Fuentes recibidas: dos adjuntos de Shirley y mensaje consolidado, que reemplaza su firma inicial de un único objeto. La recomendación vigente de Shirley usa la misma firma de dos argumentos y REVIEW_PAYMENT. No reabrir la opción antigua findForPayment({ bookingId, context }) ni REVIEW_PROOF como si fueran alternativas actuales. Las respuestas de este apartado son propuesta técnica de Leslie preparada por Codex para revisión/envío; no prueba de aceptación humana adicional ni autorización de código.

### 12.1 Firma y permisos

Conservar la firma propuesta de §3 y matriz §4. Omitir ownerId en REVIEW_PAYMENT; incluirlo solo en UPLOAD_PROOF como comprobación defensiva del consumidor. Es precisión de minimización, no permiso nuevo ni DTO accesible a otros roles. Auth/Pablo todavía debe confirmar construcción, transmisión y vigencia del contexto verificado. No guardar principal de solicitud como credencial durable.

### 12.2 Garantía comprobada de fechas

En el código local inspeccionado, createPendingBooking toma context.startedAt para createdAt.toISOString() y createBookingDeadline usa ese mismo Date más proofWindowSeconds enteros. El caso de creación prepara el contexto después de adquirir el bloqueo de inventario y el repositorio persiste ambas fechas explícitas sin defaults de hora independientes. Por ello los registros creados por ese flujo conservan la misma precisión de milisegundos y la diferencia exacta de segundos aplicada al crearlos.

createdAt representa el inicio designado por la aplicación, no timestamp del clic ni hora de COMMIT. No redondear registros incompatibles ni extender garantía a datos históricos/importados sin validarlos. El lector debe comprobar fechas válidas, diferencia entera 180..300 y coherencia antes de derivar proofWindowSeconds; de lo contrario error de integridad. Evidencia de lectura estática, no nueva prueba PostgreSQL en esta sesión.

### 12.3 Corrección de alcance para no inventar ausencia de recepción

Problema reconocido: el esquema local solo admite PENDING_PAYMENT y no registra una recepción aceptada. No se puede concluir ausencia porque Payments aún no esté conectado ni devolver false para ocultar falta de evidencia.

**Propuesta concreta a confirmar con Shirley:** primer incremento limitado a lectura base autorizada y estados realmente soportados; omitir canUploadProof y cualquier acceptedPaymentProof del DTO. No devolver true, false o null como reemplazo del dato desconocido. Añadir elegibilidad en un incremento posterior, después de que L-04/L-05 persistan y coordinen recepción–expiración.

DTO base propuesto:
- bookingId, cooperativeId, status.
- ownerId solo para UPLOAD_PROOF; omitido para REVIEW_PAYMENT.
- createdAt, expiresAt, proofWindowSeconds, totalPriceCents, currency y evaluatedAt.
- Sin canUploadProof ni vínculo/versionado inventado.

UPLOAD_PROOF en este alcance significa permiso de consultar datos propios para preparar el flujo; no habilita almacenar un comprobante ni notificar recepción con el lector incompleto. Payments debe separar este lector base de la integración productiva de carga: no mapear un campo ausente a acceptsPaymentProof false o true, ni tratar el DTO como el contrato completo anterior. Acordar adaptación/versionado explícitos de consumidor; sin sobrecarga antigua sin contexto. Si el consumidor exige el booleano para cargar, la carga productiva queda sin conectar hasta el incremento de elegibilidad. La revisión puede obtener total/plazo, sin que ello habilite aprobar ventas.

Estado inicial soportado propuesto: PENDING_PAYMENT realmente persistido, incluso después de expiresAt; leer no expira ni modifica. Estado no soportado/corrupto produce error controlado, no se traduce a disponible. F11 (revisión con recepción aceptada) permanece futuro y no cuenta como implementado.

**Precedencia de esta revisión si se acepta:** reemplaza la obligatoriedad de canUploadProof en §5 y §6 para el primer lector. Los F01/F09/F10/F17/F18 se comprueban inicialmente por autorización, campos originales, ausencia de escrituras y DTO sin booleano; sus expectativas de true/false se reservan al incremento de elegibilidad. F11 sigue condicionado a L-04. Los 20 grupos originales no se marcan todos ejecutables ni aprobados con este ajuste.

### 12.4 Errores

Conservar null indistinguible para inexistente/ajena y separar acceso/consulta inválida, integridad y temporalidad. 503 solo para temporal clasificado; 500 para integridad/excepción segura según middleware acordado. Confirmar clases/códigos exactos con Pablo y adaptación del catch de listado de Payments antes de implementar. No toda excepción se vuelve “total no disponible” temporal.

### 12.5 Estado del proveedor y próximos pasos

Spec de coordinación BOOK-07-L05 y este documento; rama local feature/BOOK-03-resumen-creacion-dominio, HEAD c7ceed9, documentación posterior sin commit. No PR de este proveedor ni función pública implementada. Los archivos intercambiados previamente con Shirley son instantáneas anteriores, no se sobrescriben silenciosamente.

Para cerrar: Shirley confirma el DTO base sin booleano y ownerId solo en carga; Pablo confirma contexto y errores; Leslie autoriza el incremento de código con pruebas reales y revisión. No confundir aceptar la propuesta documental con implementar o aprobar API de escritura.

Pendientes 6–10 conservados con responsables: Leslie/Shirley para acreditación y mutaciones/corrección/caja; Pablo participa en contexto de servicio, invitado, correo/formatos. No se aprueba aquí cerrar edición al vencer 15 minutos ni se inventa máximo de solicitudes o plazo de caja.
