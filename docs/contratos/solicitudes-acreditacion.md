# Solicitudes de acreditación — contrato disponible de B y C

Estado: implementado localmente para revisión humana; sin PR/integración. Base 46a96a2, rama feature/BOOK-08-acreditacion-web. [Spec](../specs/BOOK-08-acreditacion-web.md).

## Crear o recuperar una solicitud

POST /api/v1/booking-benefit-requests requiere sesión CUSTOMER vigente, CSRF y application/json.

Entrada cerrada: tripId, fromPosition, toPosition, seatIds, passengers y requestKey. Los pasajeros usan exclusivamente seatId, fullName, identificationNumber y birthDate conforme al manifiesto de compra existente. No aceptar propietario, cooperativa, precio, plazo, etiquetas o decisiones de acreditación desde el navegador. La identidad viene de Auth; el catálogo comercial real determina tenant, recorrido y asientos.

requestKey: 16–128 caracteres alfanuméricos ASCII, guion o guion bajo. Debe conservarse al reintentar la misma operación; no es una credencial. Se liga a propietario y huella canónica del contexto normalizado. Orden distinto de pasajeros/asientos conserva la identidad de la operación; otros datos con la misma clave generan BOOKING_BENEFIT_REQUEST_KEY_REUSED/409, sin reemplazar la primera solicitud.

Respuesta: 201 al crear; 200 al recuperar; {request: metadata}. Metadata incluye requestId, tripId, posiciones y etiquetas del tramo derivadas del servidor, passengerCount, revision, status, createdAt, expiresAt y evaluatedAt. No incluye datos personales de pasajeros, ownerId, huella, evidencia, sesión o decisiones. El reintento recupera incluso una solicitud ya vencida sin ampliar plazo ni depender de que el viaje siga admitiendo compra.

La creación no bloquea asientos, no crea reserva, no acredita beneficios ni permite obtener un total aceptado sin la revisión real. expiresAt corresponde al embarque elegido; no se utiliza el plazo de comprobante de pago en esta etapa.

## Bandeja y detalle autorizados

GET /api/v1/booking-benefit-requests solo para CLERK de su cooperativa. Query admitida: limit (1–100, predeterminado 20) y cursor opcional. Devuelve {requests:[metadata],nextCursor}. Orden createdAt DESC,id DESC. Cursor es el último requestId del lote, opaco y ligado a la cooperativa; no concede acceso ni sustituye Auth. Cursor ajeno/inexistente es consulta inválida, no lista vacía.

GET /api/v1/booking-benefit-requests/:requestId no admite query adicional. CUSTOMER propietario recibe metadata y las decisiones de sus asientos cuando ya se revisó, sin evidencia ni actor; CLERK de la cooperativa recibe metadata más seatIds/passengers y el resultado privado de revisión, copiados e inmutables en la aplicación. Otros roles no reciben permisos implícitos. Reserva ajena o solicitud inexistente tienen el mismo 404 sin revelar propietario o tenant.

Datos personales del detalle son privados para verificar documentos. No almacenarlos en URL, consola ni almacenamiento persistente del navegador. La futura vista debe mostrarlos como texto y limpiar los datos al cambiar sesión o selección. Este incremento no recupera identidades de terceros por escribir su cédula.

## Estado, errores y privacidad

Estado inicial PENDING/revision=1; tras guardar revisión, REVIEWED/revision=2 y reviewedAt persistido. Cuando evaluatedAt >= expiresAt se proyecta EXPIRED conservando la revisión histórica: no significa rechazo de pago o liberación de reserva. POST /:requestId/review está disponible en C según el contrato inferior. REVIEWED no implica que todos los datos quedaron acreditados: comprobar las decisiones explícitas.

Todos los endpoints privados marcan Cache-Control:no-store; incluso un JSON malformado recibe ese encabezado. Mutación sin CSRF falla. No hay sesión durable de un cliente en las solicitudes: solo identificadores verificados del propietario/contexto.

| Código | HTTP / significado |
|---|---|
| UNAUTHENTICATED / FORBIDDEN | 401 / 403, acceso denegado |
| BOOKING_BENEFIT_REQUEST_INVALID | 400, entrada o cursor inválido |
| BOOKING_BENEFIT_REQUEST_NOT_FOUND | 404, ausencia/ajena indistinguibles |
| BOOKING_TRIP_UNAVAILABLE | 404, viaje no admite solicitud |
| BOOKING_BENEFIT_REVIEW_CONFLICT | 409, actor, revisión o contenido no corresponden al intento persistido |
| BOOKING_BENEFIT_REVIEW_UNCERTAIN | 503, resultado de COMMIT incierto, reintentar la misma intención |
| BOOKING_BENEFIT_REQUEST_KEY_REUSED | 409, clave usada con otro contexto |
| BOOKING_BENEFIT_REQUEST_UNAVAILABLE | 503, fallo técnico temporal conocido o catálogo ausente |
| BOOKING_BENEFIT_REQUEST_INTEGRITY_ERROR | 500, incoherencia o fallo no temporal clasificado |

Errores no se transforman en lista vacía, éxito o acreditación. No incluyen SQL ni PII. No reintentar una intención diferente automáticamente ante respuesta perdida; recuperar con la misma clave y sesión autorizada.

## Persistencia y próximos incrementos

Migración nueva 1794280000000-booking-benefit-requests, B amplió el catálogo a 31 y C añade la entrada 32, historial estricto y exclusión de ocultos preservados. down rechaza solicitudes existentes sin borrarlas. No se editan migraciones anteriores ni pgmigrations manualmente.

C implementa el guardado transaccional y versionado descrito abajo; D todavía debe añadir pantalla CLERK y conexión desde el cliente. Esta API no acredita que la interfaz exista. No cambia el POST anterior /booking-benefit-reviews ni sus pruebas. Sin dependencia o frontend nuevos en B.

## Guardar revisión — incremento C

POST /api/v1/booking-benefit-requests/:requestId/review requiere CLERK de la cooperativa, sesión vigente, CSRF, application/json y ausencia de query extra. Respuesta confirmada HTTP 200: {request}, con metadata y review privado. No se escribe una segunda revisión por repetir el mismo intento.

```json
{
  "expectedRevision": 1,
  "decisions": [{
    "seatId": "identificador-del-asiento-de-la-solicitud",
    "birthDateVerified": true,
    "disabilityVerified": false,
    "evidence": [{"kind":"IDENTITY","reference":"ref_expediente_0001"}]
  }]
}
```

Debe existir una decisión exacta por asiento, sin duplicados. Evidencia: IDENTITY o BIRTH_RECORD para nacimiento, DISABILITY para discapacidad; exactamente una evidencia para cada categoría marcada true y ninguna para la categoría false. reference es opaca privada, prefijo ref_ y 4–124 caracteres ASCII de letras, dígitos, guion o guion bajo después del prefijo. No adjuntar documentos, URLs o rutas en ese campo. La referencia identifica el documento presentado; no equivale a una verificación externa de autenticidad.

Revisión pendiente 1 produce resultado 2/REVIEWED. La intención se liga a solicitud, actor/tenant verificados, versión y decisiones/evidencias ordenadas. Mismo actor, contenido y expectedRevision recuperan el resultado anterior, incluso si ahora el plazo venció. Otros datos/actor/versión devuelven 409 y no sobrescriben la revisión. No generar otra intención automáticamente ante timeout.

Catalogar y validar el contexto antes de bloquear evita pedir otra conexión del mismo pool mientras se mantiene un lock. Después se relee por id/tenant con FOR UPDATE, se valida versión/contexto y se insertan decisiones compatibles con el verificador real, guardando resultado y evidencia en la misma transacción. El UPDATE revisa expiresAt también con reloj de PostgreSQL; no extiende el plazo. Una falla revierte ambas escrituras. La respuesta solo se devuelve después de COMMIT. Si se pierde su resultado, 503 BOOKING_BENEFIT_REVIEW_UNCERTAIN: reintentar exactamente o consultar detalle autorizado, sin rechazar pagos/liberar asientos.

El dueño recibe review con fecha y decisiones de tres campos (seatId, birthDateVerified, disabilityVerified). CLERK de esa cooperativa recibe además evidencia y reviewedBy/expectedRevision en detalle; la bandeja nunca entrega evidencia, actor ni PII. El identificador interno de acreditación y la huella de intención no se exportan.

Migración aditiva 1794290000000-booking-benefit-request-reviews, sin editar B ni migraciones anteriores. Protege el contexto y resultados finalizados con restricciones/trigger y rechaza down si hay resultados con evidencia. No se reabren revisiones desde C. El endpoint legado /booking-benefit-reviews conserva su comportamiento: C no promete impedir decisiones autorizadas posteriores de ese endpoint. El resumen real consulta su última acreditación vigente y revalida viaje/precio; esta revisión no bloquea asientos ni coordina escrituras de otros módulos.
