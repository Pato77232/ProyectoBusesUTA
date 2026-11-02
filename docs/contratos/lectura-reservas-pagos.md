# Lectura de reservas para Pagos: conciliación de Auth y errores

- Fecha: 2 de noviembre de 2026, America/Guayaquil.
- Estado: diseño del lector decidido por Pablo mediante delegación reportada;
  especificación/persistencia y pruebas de los proveedores pendientes. No implementado.
- Responsable de preparación: Pablo, con asistencia de Codex.
- Base comprobada: develop 8fdf7e4; sin diferencias relevantes de Auth/errores
  respecto al checkout consultado. No se inspeccionó código privado de PAGOS-02.
- Fuente recibida: «Contrato propuesto de lectura de reservas para Pagos»,
  rama reportada feature/PAGOS-02-aprobar-comprobante, 4e6bbf7 con cambios locales.
- SHA-256 del adjunto: 8ff8d6b9b316e460951b8103f6bd42662504785bcce73b9b015157e2401afab8.
- Referencias: [acuerdos](../dependencias-pagos.md), [arquitectura](../architecture.md),
  [reglas](../business-rules.md), [PAGOS-01](../specs/PAGOS-01.md).
  PAGOS-02 y BOOK-07-L05 citados por la fuente no están publicados en esta base.

## 1. Firma y origen autorizado decididos

```js
bookings.paymentQueries.findForPayment({ bookingId, purpose }, authContext)
// authContext: { userId, role, cooperativeId }
```

bookingId es texto opaco no vacío; purpose cerrado UPLOAD_PROOF/REVIEW_PAYMENT,
fijado por el caso de uso. Rechazar campos extra, no aceptar reloj/precio/actor
como autoridad. Pablo selecciona esta firma para consumidor y proveedor; no hay sobrecarga
vieja autorizada sin contexto. No acredita que ambos lados ya estén adaptados.

API pública disponible: createAuthModule de auth/index.js entrega authenticate,
authorize y csrfProtection. auth.authenticate valida token y sesión persistida:
existencia, revocación, vencimiento y coincidencia de rol/cooperativa actuales.
Deja req.auth={user,sid}. Se decide proyectar en la frontera HTTP confiable:
userId=user.id, role=user.role, cooperativeId=user.cooperative_id; CUSTOMER usa
null y CLERK una cooperativa válida. Sin email, sid, cookies o tokens para el lector.
No existe todavía una función pública de Auth que produzca este nuevo contexto.
No importar internos de Auth ni pasar req/res al dominio/aplicación.

El objeto no es una credencial verificable por su forma o una marca booleana.
Solo lo construye el flujo interno autenticado; nunca body/query/metadatos ni
un endpoint público que acepte principal serializado. La validación ocurre al
entrar en cada solicitud, no constituye vigencia indefinida ni bloqueo frente a
revocación concurrente. Una solicitud posterior vuelve a autenticarse; requisitos
más fuertes en operaciones durables se cierran en un contrato independiente.

## 2. Permisos y errores decididos

| Principal verificado | Propósito | Lectura |
|---|---|---|
| CUSTOMER sin cooperativa | UPLOAD_PROOF | ID y propietario; tenant sale de reserva |
| CLERK con cooperativa | REVIEW_PAYMENT | ID y tenant de identidad, filtrado en Bookings |
| Otros roles, invitados o trabajadores | Cualquiera | Denegar; sin permisos implícitos |

Rol incompatible o contexto interno inconsistente: denegar antes del repositorio.
Auth puede rechazar identidad inconsistente con 401 antes de llegar al lector;
no cambiar ese comportamiento para fabricar un 403 en una solicitud inválida.
La ausencia de contexto verificado también deniega antes de leer datos.

| Situación | Código/HTTP decidido | Existencia actual y traducción |
|---|---|---|
| Sesión inválida | UNAUTHENTICATED / 401 | Auth lo traduce en su middleware |
| Rol/propósito prohibido | FORBIDDEN / 403 | Auth autoriza roles; defensa interna requiere error controlado propio |
| Consulta malformada | BOOKING_VALIDATION_ERROR / 400 | BookingValidationError existe sin httpStatus: mapear explícitamente |
| Inexistente o ajena | null interno; BOOKING_NOT_FOUND / 404 externo | Payments tiene BookingNotFoundOrNotOwnedError; usar mensaje genérico |
| Datos persistidos inválidos | BOOKING_DATA_INTEGRITY_ERROR / 500 | Código nuevo seleccionado, clase pendiente de implementación, mensaje seguro |
| Temporal identificado | BOOKING_QUERY_UNAVAILABLE / 503 | Código nuevo seleccionado, clase pendiente; clasificación explícita |
| No clasificado | INTERNAL_ERROR / 500 | Middleware global existente; no presumir fallo temporal |

No importar clases privadas del proveedor. Adaptador consumidor mapea errores
públicos documentados a clases propias compatibles con code/httpStatus/mensaje
seguro, o DomainError donde las reglas de dependencia lo permiten. El middleware
global ya soporta esa forma; no modificarlo unilateralmente ni propagar AuthError
privado fuera de Auth esperando que lo traduzca. No exponer SQL/datos corruptos.
En bandeja, null para una relación que debería existir no se omite silenciosamente;
se decide tratarlo como BOOKING_DATA_INTEGRITY_ERROR / 500 genérico, sin
revelar detalles ni omitir silenciosamente la fila.

## 3. DTO, tiempo y elegibilidad decididos

Respuesta Promise<BookingForPayment | null>, sin datos personales o estructuras
internas. Campos: bookingId, cooperativeId, status, totalPriceCents, currency,
createdAt, proofWindowStartedAt, proofWindowSeconds, expiresAt, evaluatedAt y
canUploadProof. ownerId únicamente para UPLOAD_PROOF; se omite para CLERK.
IDs opacos sin convertirlos a número o imponer UUID nuevo. Importes en centavos
enteros seguros no negativos, con USD explícito y total definitivo persistido;
no recotizar ni sustituir datos ausentes por cero. La elegibilidad comercial de
un total cero sigue las reglas de Bookings, no nace de permitir su representación.

**Decisión sobre tiempo:** createdAt conserva su significado de creación; no se
presupone que coincida con el comienzo del plazo. Se incorpora proofWindowStartedAt
como instante explícito de aceptación del resumen y creación del bloqueo por
tramo. Reservas lo persiste una sola vez junto con duración efectiva y expiresAt,
en la transacción de creación de reserva. Si createdAt ya coincide, pueden tener
el mismo valor, pero la igualdad no es un requisito inferido del código actual.

Duración configurable entre 180 y 300 segundos, capturada al crear la reserva;
expiresAt = proofWindowStartedAt + proofWindowSeconds. No cambiar al editar
configuración ni al leer. Fechas ISO UTC, precisión de milisegundos coherente,
duración entera exacta; no redondear incoherencias. Datos ausentes o discordantes
producen BOOKING_DATA_INTEGRITY_ERROR, no un plazo inventado. Si falta persistencia,
Leslie la incorpora mediante migración nueva en su incremento; no se editan
migraciones publicadas ni se derivan datos históricos sin evidencia.

**Decisión sobre recepción:** Bookings es autoridad de la recepción aceptada a
efectos de elegibilidad/expiración. Debe persistir referencia e instante de la
primera recepción aceptada, en la misma coordinación transaccional que decide
recepción frente a expiración. Campos semánticos previstos: acceptedProofId y
proofReceivedAt; nombres físicos se deciden dentro de Bookings. Ambos nulos
significan ausencia solo cuando realmente se leyeron de persistencia que aplica
este contrato. Campo no implementado/omitido no equivale a null. Solo uno nulo
es inconsistencia. Una migración no puede marcar registros históricos como
"sin recepción" mediante un default null si no existe evidencia. Primero
conciliar esos registros mediante el contrato autorizado; mientras no se
acredite su estado, no servir una elegibilidad afirmativa ni ocultar el problema.
Los reemplazos de corrección no borran esa primera recepción.
No consultar tablas privadas de Payments ni inferir ausencia de un estado aislado.

canUploadProof es true únicamente para reserva PENDING_PAYMENT con inicio,
duración y vencimiento válidos, ausencia de recepción aceptada acreditada y
reloj confiable evaluatedAt < expiresAt. En igualdad/vencimiento es false;
recepción aceptada comprobada también da false. Estados legítimos no elegibles
se enumerarán en la spec de Bookings al implementarlos; un estado desconocido o
corrupto es integridad 500, no false. Este campo describe carga inicial, no permiso
de reemplazo/corrección ni aceptación transaccional de una escritura posterior.

**Orden de entrega:** Leslie prepara persistencia de inicio/plazo y recepción;
implementa el lector con pruebas reales. Shirley adapta el consumidor y preserva
las categorías de errores. Pablo revisa Auth/contrato. Mientras falten datos, no
se conecta carga productiva ni se devuelve true mediante simulación. La recepción
transaccional y sus mutaciones tienen contrato separado; este documento fija los
datos que deberán garantizar, no implementa ni aprueba todas sus transiciones.

## 4. Errores, implementación y escenarios verificables

Se conservan códigos seleccionados en §2. El adaptador consumidor realiza mapeo
explícito de códigos públicos documentados a errores propios seguros con httpStatus;
no importa constructores privados de Auth/Bookings. BOOKING_VALIDATION_ERROR no
se propaga sin traducción esperando un 400. Los errores internos de sesión/contexto
usan UNAUTHENTICATED/FORBIDDEN en ese adaptador; la autenticación HTTP previa usa
los mecanismos de Auth ya existentes. Lo no clasificado conserva INTERNAL_ERROR.

F01–F20 del adjunto siguen como matriz de referencia, con este ajuste expreso:
F01/F15 verifican proofWindowStartedAt y duración persistida, no createdAt como
inicio supuesto; F11 solo es ejecutable después de persistir recepción. Ninguno
se cuenta aprobado antes de ejecutarse. Añadir traducción real 400/401/403/404/
500/503, no consulta al denegar, pérdida de respuesta y carreras de recepción/
expiración en su incremento específico. No mantener bloqueos entre lectura y
carga: cada mutación revalida con reloj/estado y concurrencia propios.

En QA, comparar ambos lados con Bookings y PostgreSQL reales, no solo dobles de
Payments. Las 594 unitarias/120 integraciones reportadas por Shirley no equivalen
a integración sobre develop actual ni se reutilizan como evidencia de este diseño.

## 5. Contratos separados y responsables

- Reintentos de escritura: Pablo/Leslie/Shirley acuerdan autorización específica
  de operación durable, propósito, reserva/tenant derivados por servidor y clave
  idempotente; datos de actor son auditoría, no credenciales de servicio. No guardar
  tokens ni reusar principal de solicitud; proveedor revalida estado/concurrencia.
- Invitado: [AUTH-INVITADO-01](../specs/AUTH-INVITADO-01.md); Leslie precisa relación
  compra–reserva y cooperativas; los tres cierran contexto/canje/plazos/revocación/
  reenvío/CSRF. No asumir compra=bookingId ni CUSTOMER ficticio.
- Correo: [CORREO-01](../specs/CORREO-01.md); Pablo/Shirley revisan proveedor,
  contrato, persistencia y reintentos; Leslie/Shirley definen evento de corrección
  y efecto del correo fallido, incluyendo a Pablo si afecta Auth/permisos.
- CLERK: [AUTH-06](../specs/AUTH-06.md) es borrador; endpoint no disponible.
- PDF/JPEG/PNG hasta 5 MiB ya ratificados; no reabrir el acuerdo ni afirmar que
  validación real fue comprobada en esta entrega documental.

## 6. Registro de decisión por delegación y comunicación

Pablo comunicó el 2 de noviembre de 2026: «me dijeron que aceptaron todo lo que
yo diga, entonces esta en tu decision». Se registra la delegación reportada por
Pablo para elegir el diseño del lector. No se atribuye a Leslie o Shirley una
verificación específica de createdAt, esquema, pruebas o implementación. Codex
asiste en la selección técnica; no sustituye la revisión humana de código.

Se reemplazan las preguntas de §§1–3 de la propuesta anterior por las decisiones
anteriores. El diseño del lector está seleccionado; disponibilidad y conformidad
siguen pendientes de implementación/pruebas. Correo, invitado y autorización de
trabajadores son incrementos separados; esta delegación no se usa para simular
proveedores disponibles, compras persistidas o credenciales de servicio.

Mensaje preparado para compartir, no enviado: Leslie y Shirley, por la delegación
comunicada por Pablo seleccionamos firma/contexto y errores de §§1–2. Para no
suponer garantías del modelo, el DTO incorpora proofWindowStartedAt y exige
recepción aceptada persistida antes de canUploadProof=true. Leslie prepara esos
datos/lector; Shirley adapta consumo y errores. Si el código existente necesita
migración o ajuste, se implementa y prueba en su tarea, sin volver a pedir una
aceptación genérica. Informen contradicciones funcionales o incompatibilidades
concretas, no resultados asumidos. La revisión de cada PR sigue siendo necesaria.
