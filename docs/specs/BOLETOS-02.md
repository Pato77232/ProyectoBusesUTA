# BOLETOS-02: entrega de boletos y avisos por correo

- **Estado:** borrador; tres decisiones funcionales confirmadas por el solicitante y primer incremento del puerto PNG autorizado e implementado en esta rama. Contrato técnico compartido pendiente.
- **Fecha y base comprobada:** 4 de noviembre de 2026, `origin/develop` `c9d14bf`.
- **Rama:** `feature/BOLETOS-02-envio-correo`.
- **Responsables propuestos:** Shirley para el evento y contenido de Boletos/Pagos; Pablo para el puerto y trabajador de correo. BOLETOS-01 registra que Edwin asumió la emisión de QR; confirmar con él y Shirley la integración.
- **Reglas:** RN-41/42 para destinatarios y acceso; RN-54 para emisión tras venta; RN-50–54 para aviso de corrección. Ver [reglas](../business-rules.md), [CORREO-01](CORREO-01.md), [arquitectura](../architecture.md) y [calidad](../calidad.md).

## Resultado esperado

Después de una venta confirmada, cada pasajero adulto recibe su boleto en su correo y el responsable de un menor recibe el de ese menor. El comprador conserva acceso a todos los boletos por la ruta autorizada de Boletos. Una solicitud de corrección de comprobante produce un aviso separado sin cambiar su plazo ni el estado de la venta. Una falla SMTP no repite el cobro, la venta ni la emisión.

`ACCEPTED` significa que el servidor SMTP aceptó el mensaje; no prueba entrega al buzón. La interfaz y los registros deben distinguir aviso pendiente, aceptado y fallido.

### Decisiones funcionales confirmadas en esta conversación

- **Emisión:** al confirmarse la venta; no esperar a que el cliente abra «Mis boletos». Esto exige ampliar el disparador de BOLETOS-01, que hoy emite al consultar.
- **Contenido:** datos del boleto y QR como imagen adjunta. El SVG actual de la web no equivale a ese adjunto; preparar PNG en infraestructura con la misma carga opaca del QR.
- **Alcance:** incluir también el aviso de solicitud de corrección de comprobante. La decisión de incluirlo no crea por sí sola el evento ni cierra PAGOS-CORR-01.

Estas son respuestas del solicitante; no se atribuyen como aceptación individual de Edwin, Shirley o Leslie.

## Estado comprobado de las dependencias

- `smtp-mailer.js` existe en `develop`; `CORREO-01` cubre solo el adaptador SMTP y deja abiertos el contrato de solicitud, persistencia, reintentos y confirmaciones. La recuperación de cuenta tiene un trabajador propio, no un puerto reutilizable para boletos.
- `BOOK-09` ofrece lectura interna de ventas vendidas. La rama remota `feature/BOLETOS-01-emision-qr` (`2dac0c0`) tiene emisión idempotente, endpoint y página de QR, pero está fuera de `develop` comprobado. Su spec excluye el envío por correo.
- BOLETOS-01 materializa el boleto al abrir la consulta del propietario. Para garantizar un correo tras cada venta, falta un disparador durable de venta y emisión sin visita del cliente, o un cambio de alcance acordado. No se puede equiparar esa consulta a una entrega automática.
- El manifiesto actual de Bookings solo acepta `seatId`, cédula, nombre y fecha de nacimiento por pasajero. No persiste el correo individual ni el contacto adulto de menores que exige RN-41/42. El lector de boletos tampoco expone destinatarios.
- No hay en esta base un evento de solicitud de corrección ni una spec final `PAGOS-CORR-01`; ese aviso depende de que Pagos defina el evento y su plazo. No se enviará correo al aprobar/rechazar un comprobante por inferencia.

## Contrato propuesto para revisión

1. **Origen del aviso:** Boletos solicita entrega solo para boletos ya emitidos de una venta `SOLD`; Pagos solicita aviso solo al persistir una solicitud de corrección autorizada. Cada módulo publica su solicitud por API pública o puerto inyectado. El navegador no elige destinatarios, remitente ni texto.
2. **Destinatarios:** Bookings captura y congela el correo de cada pasajero adulto o el correo del responsable adulto de cada menor al confirmar el resumen. La misma dirección puede recibir varios boletos, pero cada boleto conserva su destinatario autorizado. La identidad del comprador da acceso a todos en la web, no sustituye esas direcciones.
3. **Identidad e idempotencia:** una clave estable por evento, propósito, boleto y destinatario; para corrección, por solicitud/version y destinatario. Registrar la solicitud durable antes de procesarla. Repetir el mismo evento no crea avisos nuevos; misma clave con contenido distinto es conflicto.
4. **Procesamiento:** un trabajador reclama pendientes con bloqueo transaccional, envía mediante el puerto `send({to, subject, text, notificationId})` de `smtp-mailer.js` y registra aceptación o fallo. Reintentos, plazos, retención y clasificación de resultado incierto necesitan acuerdo específico antes de codificar. SMTP no se invoca dentro de la transacción de venta ni de la petición HTTP.
5. **Privacidad:** el correo contiene datos del boleto correspondiente y su QR adjunto; no incluye boletos de otros pasajeros ni una URL pública permanente. El QR opaco de BOLETOS-01 no se convierte en credencial de acceso. No registrar cédulas, direcciones completas ni contenido en logs técnicos.

El puerto SMTP de este incremento acepta además un adjunto PNG validado sin permitir rutas o URLs arbitrarias. El contenido sensible del aviso de corrección y el destinatario se fijarán con Pagos. Ningún adjunto debe depender de una URL pública que exponga la cédula.

## Incrementos revisables

1. **Puerto de adjuntos, tarea de Pablo:** ampliar el adaptador SMTP para aceptar, además de los cuatro campos actuales, un único PNG de QR opcional. La entrada propuesta es `attachment: { filename, contentType: 'image/png', content: Buffer }`; nombre seguro sin rutas ni saltos de línea, bytes PNG verificados y límite pequeño definido en el código. El adaptador entrega el Buffer a Nodemailer con acceso a archivos y URLs deshabilitado. Sin adjunto, los consumidores actuales conservan su contrato. Pruebas unitarias con transporte controlado: mensaje de texto, PNG válido, formato/tamaño/nombre inválidos, rechazo y resultado incierto. No enviar correo real.
2. Acordar captura y persistencia de destinatarios con Leslie y Shirley; ampliar Bookings y sus pruebas en una tarea propia, sin aceptar correos arbitrarios en la solicitud de envío.
3. Cerrar el contrato común de `CORREO-01` para registro durable, estados, reintentos y operación del trabajador; implementar el puerto compartido con pruebas y sin SMTP real en tests.
4. Conectar el evento idempotente de BOLETOS-01 a la entrega, una vez integrada la emisión. Probar venta, emisión y correo aceptado/fallido con PostgreSQL aislado, sin duplicar boletos ni mensajes.
5. Conectar el aviso de corrección cuando Pagos publique el evento y su spec aprobada. Verificar que el plazo de corrección no depende del correo.

Si se agrega captura de correo en el formulario, aplicar `frontend/DESIGN.md`: etiqueta visible por pasajero, indicación clara de correo de responsable para menores, error junto al campo y lectura usable con teclado y móvil. Ninguna pantalla se considera aprobada o implementada por esta mención.

## Decisiones pendientes

| Decisión | Participantes afectados | Recomendación y efecto |
| --- | --- | --- |
| Quién implementa la conexión de Boletos, dado que Edwin asumió BOLETOS-01 | Edwin, Shirley, Pablo | Shirley define contenido/evento; Pablo aporta el puerto común; acordar autor y revisor de cada incremento. |
| Captura y conservación de correos de pasajeros/responsables | Leslie, Shirley, Pablo | Guardarlos en Bookings al confirmar el resumen; requiere contrato de formulario, validación, privacidad y migración nueva. |
| Política de reintentos, resultado incierto y retención | Shirley, Pablo | Reutilizar el patrón del trabajador de Auth sin compartir sus tablas ni tokens; fijar valores y pruebas en CORREO-01. |
| Aviso de corrección: evento, destinatario y plazo | Shirley, Leslie, Pablo | Cerrar PAGOS-CORR-01 antes de conectar el envío; no inferirlo de la aprobación/rechazo actual. |
| Disparador técnico de emisión sin visita | Edwin, Shirley, Leslie, Pablo | Venta `SOLD` persistida como evento durable; trabajador emite/encola sin depender de la petición HTTP o de la página. |
| Datos y destinatario del aviso de corrección | Shirley, Leslie, Pablo | Definir evento/version, plazo ya persistido, motivo público permitido y correo de contacto autorizado en PAGOS-CORR-01. |

La aprobación de este borrador exige confirmar las decisiones compartidas relevantes. La revisión humana de código sigue siendo independiente. No se crean defectos inducidos para esta funcionalidad.

## Primer incremento y verificación local

El solicitante aprobó expresamente empezar por el puerto PNG de Pablo. Contrato en `9f138a3`; puerto y pruebas en `c4f001a`. `smtp-mailer.js` conserva los mensajes de texto y acepta un único `attachment` opcional con nombre seguro, MIME `image/png`, Buffer de hasta 256 KiB y estructura básica PNG (firma, IHDR y cierre IEND). Copia los bytes antes del envío; mantiene deshabilitado el acceso a rutas y URL de Nodemailer. No se añadió dependencia ni se configuró SMTP real.

Pruebas del adaptador: 21/21 aprobadas. Backend `npm run lint` y `npm run format:check`: aprobados. Suite completa con PostgreSQL temporal aislado: 2025/2025 unitarias y 687/688 integraciones; falló `fleet/bus-seat-immutability.test.js` al revertir una migración de Flota. Repetición dirigida de esa suite: 8/9 aprobadas, mismo fallo. No se editaron pruebas ni migraciones. El resultado global no se presenta como aprobado.

Quedan pendientes la revisión humana, los acuerdos de destinatarios y eventos, y los incrementos 2 a 5. La implementación del puerto no acredita entrega de correos ni integración de BOLETOS-02.

## Consulta preparada para el equipo; aún no enviada

**Shirley, Leslie y Edwin:** el solicitante confirmó correo automático al vender,
QR PNG adjunto y aviso de corrección en esta entrega. BOLETOS-01 hoy emite al
consultar y Bookings no conserva correos por pasajero/responsable; Pagos aún no
publica el evento de corrección. Pablo preparó el puerto SMTP para PNG.
¿Confirman qué módulo publica cada evento durable, dónde se
congelan destinatarios, qué datos del aviso de corrección son públicos y quién
implementa/revisa cada conexión? Esta consulta no se considera respondida por
la aprobación funcional del solicitante.
