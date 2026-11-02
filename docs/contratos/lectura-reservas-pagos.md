# Lectura de reservas para Pagos: conciliación de Auth y errores

- Fecha: 2 de noviembre de 2026, America/Guayaquil.
- Estado: propuesta técnica para revisión de Leslie y Shirley; no implementada.
- Responsable de preparación: Pablo, con asistencia de Codex.
- Base comprobada: develop 8fdf7e4; sin diferencias relevantes de Auth/errores
  respecto al checkout consultado. No se inspeccionó código privado de PAGOS-02.
- Fuente recibida: «Contrato propuesto de lectura de reservas para Pagos»,
  rama reportada feature/PAGOS-02-aprobar-comprobante, 4e6bbf7 con cambios locales.
- SHA-256 del adjunto: 8ff8d6b9b316e460951b8103f6bd42662504785bcce73b9b015157e2401afab8.
- Referencias: [acuerdos](../dependencias-pagos.md), [arquitectura](../architecture.md),
  [reglas](../business-rules.md), [PAGOS-01](../specs/PAGOS-01.md).
  PAGOS-02 y BOOK-07-L05 citados por la fuente no están publicados en esta base.

## 1. Firma y origen autorizado propuestos

```js
bookings.paymentQueries.findForPayment({ bookingId, purpose }, authContext)
// authContext: { userId, role, cooperativeId }
```

bookingId es texto opaco no vacío; purpose cerrado UPLOAD_PROOF/REVIEW_PAYMENT,
fijado por el caso de uso. Rechazar campos extra, no aceptar reloj/precio/actor
como autoridad. La firma nueva requiere acuerdo de consumidor y proveedor;
no hay sobrecarga vieja autorizada sin contexto.

API pública disponible: createAuthModule de auth/index.js entrega authenticate,
authorize y csrfProtection. auth.authenticate valida token y sesión persistida:
existencia, revocación, vencimiento y coincidencia de rol/cooperativa actuales.
Deja req.auth={user,sid}. Proyección candidata en la frontera HTTP confiable:
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

## 2. Permisos y errores por conciliar

| Principal verificado | Propósito | Lectura |
|---|---|---|
| CUSTOMER sin cooperativa | UPLOAD_PROOF | ID y propietario; tenant sale de reserva |
| CLERK con cooperativa | REVIEW_PAYMENT | ID y tenant de identidad, filtrado en Bookings |
| Otros roles, invitados o trabajadores | Cualquiera | Denegar; sin permisos implícitos |

Rol incompatible o contexto interno inconsistente: denegar antes del repositorio.
Auth puede rechazar identidad inconsistente con 401 antes de llegar al lector;
no cambiar ese comportamiento para fabricar un 403 en una solicitud inválida.
La ausencia de contexto verificado también deniega antes de leer datos.

| Situación | Código/HTTP propuesto | Existencia actual y traducción |
|---|---|---|
| Sesión inválida | UNAUTHENTICATED / 401 | Auth lo traduce en su middleware |
| Rol/propósito prohibido | FORBIDDEN / 403 | Auth autoriza roles; defensa interna requiere error controlado propio |
| Consulta malformada | BOOKING_VALIDATION_ERROR / 400 | BookingValidationError existe sin httpStatus: mapear explícitamente |
| Inexistente o ajena | null interno; BOOKING_NOT_FOUND / 404 externo | Payments tiene BookingNotFoundOrNotOwnedError; usar mensaje genérico |
| Datos persistidos inválidos | BOOKING_DATA_INTEGRITY_ERROR / 500 | Código/clase nuevos propuestos, mensaje seguro |
| Temporal identificado | BOOKING_QUERY_UNAVAILABLE / 503 | Código/clase nuevos propuestos; clasificación explícita |
| No clasificado | INTERNAL_ERROR / 500 | Middleware global existente; no presumir fallo temporal |

No importar clases privadas del proveedor. Adaptador consumidor mapea errores
públicos documentados a clases propias compatibles con code/httpStatus/mensaje
seguro, o DomainError donde las reglas de dependencia lo permiten. El middleware
global ya soporta esa forma; no modificarlo unilateralmente ni propagar AuthError
privado fuera de Auth esperando que lo traduzca. No exponer SQL/datos corruptos.
En bandeja, null para una relación que debería existir no se omite silenciosamente;
acordar su tratamiento como inconsistencia sin revelar detalles al usuario.

## 3. DTO, tiempo y alcance del primer incremento

Conservar DTO mínimo de la fuente: bookingId, cooperativeId, status, totalPriceCents,
currency USD, createdAt/expiresAt/evaluatedAt ISO UTC, proofWindowSeconds y
canUploadProof; ownerId solo para carga. Validar sin recotizar ni sustituir datos
faltantes por cero. El total no negativo del DTO debe conciliarse con las reglas
de total definitivo de Bookings; no se autoriza compra gratuita por este documento.

Leslie debe confirmar que createdAt es el inicio contractual exacto y que las
fechas permiten duración entera 180..300 segundos, sin redondeo ni configuración
viva. Debe explicar cómo demuestra ausencia de recepción aceptada antes de
canUploadProof=true. Con persistencia insuficiente, ajustar alcance o desarrollar
esa persistencia en otro incremento aprobado; no inventar null/false/ausencia.
No usar la fotografía del lector como autorización de una escritura posterior.

F01–F20 del adjunto son escenarios propuestos, no pruebas ejecutadas. F11 requiere
persistencia de recepción todavía no acreditada. Añadir pruebas de traducción
real 400/401/403/404/500/503 y comprobar no consulta en accesos denegados. Reservas
prueba su proveedor en PostgreSQL; Payments prueba adaptación y combinación real.
No confundir las 594 unitarias/120 integraciones reportadas por Shirley en su rama
con resultados de integración sobre develop actual.

## 4. Contratos separados y responsables

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

## 5. Consulta lista para compartir; no enviada

Leslie y Shirley: revisen §§1–3 y respondan con aceptación o ajuste concreto de
contexto/errores. Leslie, precisamos inicio de plazo, ausencia de recepción y
relación compra–reserva. No implementaremos el lector real hasta cerrar esos
puntos. Envíen ubicación publicada de PAGOS-02 y BOOK-07-L05 para enlazar specs
sin recrearlas. Aceptar este lector no aprueba mutaciones, caja, correo o invitados.
