# BOOK-06-L04-T3: adaptador del aviso para Payments

- ID local, continuación de BOOK-06-L04-T2 incremento C; no ID externo.
- Estado: C1 implementado y probado localmente en la continuación solicitada por Leslie; revisión humana, commit y publicación pendientes.
- Origen: «listo sigamos con el siguiente paso porfavor» y delegación técnica registrada en T2 §11. No se atribuyen nuevas aprobaciones individuales a Shirley/Pablo.
- Base comprobada: origin/develop b4fe717, PR #60 integrada; rama feature/BOOK-06-adaptador-aviso-pagos. Sin commits/push autorizados para esta rama nueva.
- Relacionadas: [BOOK-06-L04-T2](BOOK-06-L04-T2.md), [PAGOS-01](PAGOS-01.md), [PAGOS-02](PAGOS-02.md).

## 1. Estado observado y alcance

PR #55 (ca63a36) y #56 (15218ae) de Shirley siguen abiertas: lector de revisión y prueba conjunta, sin recepción. Se comprueban directamente; el buscador de PR devolvió vacío, por lo que no se usa como evidencia de ausencia. No se copian ni integran sus cambios.

UploadPaymentProof.notifyBooking marca entregada cualquier promesa resuelta; excepciones genéricas de rechazo o plazo disparan borrado. T2 devuelve outcomes estructurados. C1 aporta solo el puente seguro de ese contrato ya seleccionado, expuesto por la API pública de Payments y sin conectarlo a server.js ni a rutas. No cambia la carga, persistencia, reintentos automáticos, venta o rechazo del oficinista.

## 2. Contrato seleccionado para C1

payments.createBookingPaymentProofNotifier({ receiptReceiver }) devuelve una capacidad congelada con markPaymentProofReceived({ bookingId, cooperativeId, paymentProofId }). receiptReceiver debe exponer la función pública de Bookings creada por createPaymentProofReceiver; se captura ligada en composición confiable. No hay fallback simulado, importaciones internas de otro módulo ni principal SERVICE.

La solicitud exige exactamente los tres IDs opacos no vacíos, y se copia antes del primer await. La respuesta exige los mismos vínculos y campos exactos: outcome ACCEPTED con acceptedAt, o REJECTED_EXPIRED con rejectedAt. Instante ISO UTC canónico. No usa reloj local ni compara una repetición aceptada con el plazo actual.

- ACCEPTED validado: resuelve con una copia inmutable del resultado, permitiendo marcar entregado.
- REJECTED_EXPIRED validado: crea PaymentProofUploadDeadlineExpiredError, la señal de compensación ya existente. Solo un resultado definitivo resuelto por Bookings autoriza esta traducción.
- Entrada/respuesta incoherente, vínculos distintos, outcome desconocido o cualquier excepción del proveedor: BookingNotificationUncertainError (503) seguro, sin filtrar SQL/mensajes ni propagar una excepción que por su clase dispare borrado. Incluso una excepción del proveedor llamada «plazo vencido» no sustituye el resultado durable acordado.
- Sin fuente/capacidad al componer: TypeError, sin alternativa ficticia.

No introducir timeout arbitrario: si el transporte rechaza por timeout se conserva incertidumbre; un trabajo pendiente no se declara finalizado. Mismo comprobante se reintenta por el mecanismo actual y el contrato idempotente de Bookings; C1 no ejecuta un trabajador durable.

## 3. Archivos y verificación

Nuevo adaptador infrastructure/bookings-payment-proof-notifier.js y export en payments/index.js. Pruebas unitarias de clasificación, copia y fallos; verificar notifyBooking real con puertos unitarios para distinguir entrega/compensación. Prueba PostgreSQL de ambos módulos mediante sus APIs públicas: aceptación, vencimiento, respuesta perdida y reintento, vínculos/fuente inválidos sin efectos. La fuente de comprobante es fixture QA persistida, no la consulta productiva pendiente de Payments; tampoco acredita Auth HTTP de carga.

Ejecutar backend lint, format:check, npm test con PostgreSQL aislado y arranque real existente al ampliar la API de composición. No dependencias nuevas, .env, bases persistentes, migraciones o pruebas debilitadas. No cambia frontend: DESIGN.md no aplica a este incremento backend sin pantalla.

## 4. Incrementos posteriores y límites

C2: consulta pública de comprobante/outbox persistidos en Payments y procedencia de carga verificada con Auth/UPLOAD_PROOF. Debe delimitar historia previa procedente del lector simulado: persistir un comprobante por sí solo no demuestra autorización sobre una reserva real. No validar esa procedencia mediante un flag inventado o una sesión guardada.

C3: componer fuente/puertos reales y carga autorizada; probar archivo/outbox, aviso perdido, recuperación y compensación. Resolver con Shirley el alcance de entrega/reintentos antes de activarlo. D, planificador de Reservas, conserva spec separada.

C1 no demuestra conexión productiva ni garantiza que el consumidor legado sea seguro ante fallos de borrado: el adaptador solo limita qué señal puede llegar a ese camino. Revisión humana, activación y cierre pendientes. Evidencia/estado se actualizan con resultados reales al terminar.


## 5. Resultado local y evidencia

Implementados export público y adaptador de resultados; no activados en composición productiva. [Evidencia](../evidence/BOOK-06-L04-T3/2026-11-03-adaptador-aviso.md): 35 pruebas iniciales dirigidas; suite global 1688 unitarias + 521 integraciones aprobadas. Tras completar captura única del outcome, repetición final de todas las unitarias 1689/1689 y las cinco integraciones propias 5/5. Total de casos nuevos: 31 unitarias y cinco integraciones.

Lint y formato propio aprobados; formato global conserva 17 archivos ajenos. Arranque real incluido en integración global; fotografías aprobadas sin modificar límites. PostgreSQL y red exclusivos retirados. Solo puertos unitarios o fuente QA persistida en pruebas; no Auth HTTP ni procedencia productiva del comprobante demostrados por C1.

Sin commits/push ni PR de esta rama nueva. Checkpoint sugerido: feat(pagos): valida los resultados del aviso a reservas. C2/C3 y coordinación con Shirley siguen pendientes, sin sustituir sus PR #55/#56. La revisión de IA y estos resultados no equivalen a aprobación humana.

## 6. Publicación autorizada

Leslie autoriza expresamente commit y push de C1 en feature/BOOK-06-adaptador-aviso-pagos. Se conserva la validación y alcance anteriores; no se autoriza merge ni se atribuye revisión humana. El hash de publicación se consulta en Git; no se inventa un número de PR.
