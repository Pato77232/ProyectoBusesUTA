# BOOK-BENEF-02: Descuento por edad automático y revisión solo para discapacidad

- **ID local:** BOOK-BENEF-02. Sin ticket externo.
- **Origen:** pedido compartido por Edwin (pato77232) el 11 de noviembre de 2026, con tres cambios: edad automática, revisión solo para discapacidad con foto del documento, y pantalla de pago por transferencia o depósito.
- **Participantes que deben decidir:** David (confirmó el 4 de noviembre que la oficinista revisa la fecha de nacimiento antes del total), Leslie (Reservas y acreditación web, BOOK-08), Shirley (propuso acreditar antes del total y es dueña de Pagos) y Edwin. El silencio no es aprobación.
- **Estado:** Edwin informó el 11 de noviembre de 2026 que el equipo lo aprobó («Ya lo aprobaron»). Se implementa la **fase 1 con la opción B**. Las fases 2 y 3 siguen esperando las respuestas de §6 (retención del carnet y datos bancarios). Revisión del código pendiente, sobre todo de Leslie (Reservas).
- **Base comprobada:** `feature/FRONT-02-cierre-flujo-web`, desde `origin/develop` `162c80b`.

## 1. Situación actual

- En compras en línea con viaje comercial, **todo pasajero** necesita que una oficinista marque «Fecha de nacimiento verificada» antes de ver el total. Lo exige `verifiedBenefits` en `backend/src/modules/bookings/application/booking-purchase-context.js` (`schemaVersion === 2`), aunque el pasajero no pida descuento.
- La acreditación es presencial: el comprador pulsa «Solicitar revisión de documentos», va a la cooperativa con sus documentos y la oficinista registra una referencia `ref_…`. No se sube ninguna foto.
- El pago por transferencia ya existe: al confirmar la reserva aparece «Sube tu comprobante de pago» (JPG, PNG o PDF de hasta 5 MB) y la reserva queda en «Pendiente de pago» hasta que la oficinista aprueba o rechaza.

## 2. Decisiones vigentes que cambiarían

| Documento | Dice hoy | Cambio pedido |
|---|---|---|
| `business-rules.md`, encabezado (David, 4 de noviembre) | La oficinista revisa fecha de nacimiento y discapacidad antes del total aceptado. | Edad calculada sola desde la fecha de nacimiento; solo la discapacidad se revisa. |
| `estado-proyecto.md` (Leslie y Shirley) | «Verificar antes del total aceptado»; una estimación no autoriza pagar con beneficio sin verificar. | El beneficio por edad se aplica sin verificación previa en línea. |
| `business-rules.md`, pregunta 1 | La acreditación real requiere una fuente o revisión autorizada; no simularla. | La edad se toma de lo que declara el comprador. |

## 3. Riesgo principal y cómo cubrirlo

Si la edad sale solo de la fecha que escribe el comprador, cualquiera puede declarar 70 años y obtener el descuento. El pedido apoya el cambio en que «se valida con la cédula»; en la práctica, eso pasa **al embarcar**, que es tarea del Chofer o Controlador, rol fuera de esta fase.

Opciones:
- **A. Edad automática sin control posterior.** Es lo más simple, pero el descuento queda sin verificar en esta fase.
- **B. Edad automática, con el boleto marcado «Descuento por edad: presentar cédula al embarcar»** y la cédula impresa en el boleto, como ya ocurre. El control queda documentado para la fase del Chofer. **Recomendada.**
- **C. Mantener la revisión actual de la edad.** No cambia nada.

## 4. Propuesta por fases

### Fase 1: edad automática y revisión solo por discapacidad (sin fotos)

- **Backend:**
  - En `verifiedBenefits`, la fecha de nacimiento ya no exige revisión. Menores de 18 y mayores de 65, calculados a la fecha local del embarque como hoy, reciben su descuento automáticamente.
  - Solo la discapacidad (`disabilityVerified`) sigue exigiendo una revisión de la oficinista.
  - La boletería (BOOK-CAJA-02) se ajusta igual: la casilla de fecha comprobada deja de ser obligatoria.
- **Frontend de reservas:**
  - El formulario del pasajero agrega «Tengo una discapacidad acreditada (requiere revisión de la cooperativa)».
  - Sin esa marca, «Ver resumen» muestra el total con el descuento por edad, sin pasar por la oficinista.
  - Con la marca, aparece «Solicitar revisión de discapacidad».
- **Oficinista:** «Acreditar beneficios» muestra solo las solicitudes de discapacidad.
- **Boleto:** si hubo descuento por edad, indica «Presentar cédula al embarcar» (opción B).
- **Pruebas:** se actualizan las que hoy exigen la revisión para todo pasajero. Ese cambio es una decisión de negocio que se registra aquí, no un debilitamiento.
- **Esfuerzo:** pequeño a mediano. No requiere migraciones.

### Fase 2: foto del carnet de discapacidad

- El comprador sube una imagen o PDF del carnet al pedir la revisión, y la oficinista la ve antes de decidir.
- Requiere una migración nueva y almacenamiento privado (como los comprobantes), con acceso solo para la oficinista de esa cooperativa.
- Es un **dato de salud sensible**, así que hay que definir cuánto tiempo se guarda (propuesta: borrar al terminar el viaje) y que nunca se muestre en listados.
- **Esfuerzo:** mediano. Necesita definir con el equipo la retención y quién puede verla.

### Fase 3: pantalla de pago

- Lo esencial ya existe. Se propone que, al confirmar la reserva, la sección se titule «Forma de pago: transferencia o depósito», con los datos para depositar y la carga del comprobante. El estado «Pendiente de revisión del pago» debe verse igual en la reserva, en «Mis reservas» y en «Mi cuenta».
- **Falta un dato:** las cuentas bancarias de cada cooperativa no están en el sistema (las reglas lo dejan pendiente). Opciones: un texto de instrucciones configurable por cooperativa (requiere migración) o un texto fijo provisional.

## 5. Criterios de aceptación (fase 1)

- [ ] Un pasajero de 70 años sin discapacidad ve el descuento en el resumen sin solicitar revisión.
- [ ] Un adulto sin descuento confirma la reserva sin pasar por la oficinista.
- [ ] Quien marca discapacidad no puede confirmar con ese descuento hasta que la oficinista lo acredite.
- [ ] La edad se calcula a la fecha del embarque elegido; un cumpleaños entre hoy y el viaje cuenta.
- [ ] El boleto con descuento por edad indica que se presenta la cédula al embarcar.

## 6. Preguntas para el equipo

1. ¿Se acepta que la edad se tome de la fecha declarada, con control al embarcar (opción B)? Participantes: David, Leslie, Shirley.
2. ¿Hace falta la foto del carnet (fase 2) o basta la revisión presencial actual? Si se sube, ¿cuánto tiempo se guarda?
3. ¿De dónde salen los datos bancarios para la pantalla de pago?

## 6 bis. Implementación de la fase 1 (11 de noviembre de 2026)

**Backend:** `booking-purchase-context.js` deja de exigir `birthDateVerified`. Si no hay revisión vigente (`BOOKING_BENEFIT_REVIEW_REQUIRED`), se cotiza sin descuento por discapacidad; cualquier otro error del verificador se propaga.

**Pruebas que describían la regla anterior**, actualizadas a la nueva y marcadas con un comentario «BOOK-BENEF-02», para que Leslie las revise:
- `tests/unit/bookings/get-booking-summary.test.js`
- `tests/integration/bookings/benefit-requests.http.test.js` (dos casos)
- `tests/integration/bookings/booking-http.test.js`
- `tests/integration/bookings/commercial-purchase.test.js` (tres casos; además se agregó la tercera edad automática)
- `tests/integration/bookings/create-booking.test.js`
- `tests/integration/bookings/counter-sales.http.test.js`

Se agregaron casos para cotizar sin revisión y para un fallo del verificador. Suite completa en PostgreSQL aislado: lint y formato en verde, 2237 unitarias y 750 de integración.

**Frontend:**
- Casilla «Tengo una discapacidad acreditada» por pasajero. El panel «Revisión de discapacidad» solo aparece si alguien la marca, y su texto explica que los descuentos por edad se aplican solos y que la cédula se presenta al embarcar.
- En boletería, la casilla de fecha comprobada deja de ser obligatoria.

**Cédula inválida (reportado por Pablo el 11 de noviembre de 2026):** una cédula con dígito verificador incorrecto solo producía «Los datos de la reserva no son válidos». Ahora `src/bookings/cedula.js` aplica la misma comprobación (módulo 10) en reservas y boletería. El campo queda marcado con «La cédula no es válida: revisa que los 10 dígitos estén bien escritos» y no se envía. Frontend: 480 de 480 y lint en verde.

**Docker QA:** con `qa.cliente`, una cédula con verificador incorrecto queda marcada en el campo. Con una cédula válida y nacimiento en 1950, «Ver resumen» muestra tarifa base $5,50, descuento $2,75 y total $2,75, sin solicitar revisión. El panel de revisión permanece oculto sin la casilla de discapacidad.

**Pendiente:** el aviso «Presentar cédula al embarcar» en el boleto (opción B), y las fases 2 y 3 (§6).

## 7. Defecto inducido

No aplica.

## 8. Revisión

Borrador preparado con asistencia de IA el 11 de noviembre de 2026. Sin código y sin commits.
