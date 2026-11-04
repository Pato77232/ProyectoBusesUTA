# BOOK-06-L04-T3: adaptador seguro de aviso, C1

3 de noviembre de 2026, America/Guayaquil. Rama local feature/BOOK-06-adaptador-aviso-pagos desde origin/develop b4fe717. PR #60 integrada a las 19:07:02Z, comprobada en GitHub. Leslie pide continuar el siguiente paso; se delimita el puente C1 con las reglas ya seleccionadas de BOOK-06-L04-T2. Sin nueva aprobación individual de Shirley/Pablo ni autorización para publicar esta rama.

## Trabajo existente y alcance

Consulta directa de PR #55: abierta, ca63a36, consumidor de lectura REVIEW_PAYMENT sin activar en servidor. PR #56: abierta, 15218ae, prueba conjunta dependiente de #55. No se duplican ni integran; el buscador devolvió cero resultados y se contrastó directamente, sin inferir ausencia.

Nuevo adaptador en infraestructura de Payments y export público createBookingPaymentProofNotifier junto a createPaymentsModule. Captura capacidad ligada y entrada antes de await; copia/valida respuesta, vínculos, outcome y fecha canónica. ACCEPTED resuelve; solo REJECTED_EXPIRED resuelto y vinculado crea el error de plazo existente. Toda excepción del proveedor, incluso de una clase de rechazo, se convierte en incertidumbre segura y no autoriza compensación por su nombre.

La revisión detecta que el outcome se leía antes y durante la copia. Se completa captura única antes de validar y una regresión con getter cambiante para impedir clasificar/borrar por dos lecturas distintas. Un primer intento de aplicar esta mejora usó una ruta relativa incorrecta desde backend y no editó archivos; el comando posterior iniciado de pruebas corresponde al estado previo. Se aplica desde la raíz y se repiten las comprobaciones pertinentes sobre el resultado final, sin atribuir conteos previos a la regresión nueva.

No se activa en server.js ni en rutas, no se cambia UploadPaymentProof, repositorios, persistencia, simuladores, dependencias o migraciones. La conexión productiva exige C2/C3.

## Pruebas

Primera prueba dirigida: 30 unitarias y cinco integraciones nuevas, 35/35 aprobadas. Las unitarias incluyen notifyBooking real con puertos controlados: solo aceptación marca entregado y solo rechazo definitivo vinculado permite la compensación actual. Entrada/respuesta incorrectas y excepciones del proveedor conservan evidencia.

Integración mediante API pública de Bookings y API pública de Payments, con PostgreSQL real: aceptación/asientos conservados; vencimiento confirmado y repetición; commit real con respuesta perdida, nueva instancia y recuperación; fuente incoherente y reutilización con otra cooperativa sin efectos. La fuente es una tabla QA en esquema aleatorio notifierqa_*, no una consulta productiva de Payments ni prueba de Auth HTTP de carga.

Node 24.21.0, PostgreSQL 16.13 temporal exclusivo busesuta-leslie-aviso-c1, tmpfs/puerto 55433. Sin .env ni bases persistentes. Lint inicial aprobado; formato global conserva 17 archivos ajenos. La ejecución global iniciada antes de la captura única final pasó: 1688 unitarias + 521 integraciones = 2209, 127 suites, salida 0 (integración 301,598 s). Incluye arranque real y fotografías, sin modificar timeout ni aserciones.

Verificación final tras completar captura/regresión: todas las unitarias repetidas 1689/1689 (87 suites, 10,384 s) y las cinco integraciones propias repetidas 5/5 (2,889 s), salida 0; son 31 unitarias nuevas y cinco integraciones nuevas. No se presenta la ejecución global anterior como si incluyera la prueba adicional. Lint repetido aprobado y formato de los cuatro JS propios aprobado; el control global conserva 17 archivos ajenos.

Diff completo revisado, altas incluidas; git diff --check aprobado. No cambian servidor, app, casos de uso previos, migraciones o dependencias; no se ejecutan pruebas frontend por un adaptador backend sin cambios de pantalla. No se introducen defectos académicos.

Limpieza final comprobada: contenedor/red busesuta-leslie-aviso-c1 retirados y consultas por etiqueta vacías. Esquema aleatorio notifierqa_* retirado por la fixture; no se tocaron servicios ajenos.

## Pendientes

C2 debe aportar la fuente pública de comprobante/outbox y procedencia autorizada mediante Auth/UPLOAD_PROOF, sin adoptar como acreditadas las cargas históricas generadas con lector simulado. C3 conectará y comprobará la carga/aviso/compensación reales. Este adaptador no incorpora trabajador durable, planificador, aprobación, rechazo justificado, correcciones, caja o invitado.

Leslie autoriza guardar y publicar C1: «listo entonces si ya crees conveniente hacer commit y push hazlo». Revisión humana e integración de C1 pendientes. El export de C1 y createPaymentReviewModule de PR #55 deben conservarse ambos cuando se concilien sus ramas; no se modifica la rama de Shirley.
