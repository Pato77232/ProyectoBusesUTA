# BOOK-08 — acreditación de beneficios en la web

- Responsable: Leslie Coello. Referencias locales: BOOK-08-L06 y BOOK-03-L03-T1.
- Fecha: 4 de noviembre de 2026. Base observada: origin/develop 46a96a2, con PR #98 integrada.
- Rama: feature/BOOK-08-acreditacion-web. Sin ticket externo.
- Estado: incrementos B y C implementados y verificados localmente; D y revisión humana pendientes. La preparación anterior se conserva como historia.
- Solicitud: Leslie acepta comenzar con la preparación de la spec. Conserva la delegación anterior de decisiones de contratos; no se atribuye aprobación de código/PR a otros integrantes. La revisión humana y la integración no quedan sustituidas por este documento.

## 1. Problema y resultado esperado

El comprador necesita acreditar beneficios antes de aceptar el total. La API real POST /api/v1/booking-benefit-reviews registra decisiones CLERK para un contexto completo de compra, pero no ofrece GET de bandeja/detalle ni solicitudes pendientes. Su respuesta contiene únicamente reviewedAt y expiresAt; no tiene referencia privada de evidencia ni clave de reintento. No hay pantalla de acreditación en frontend ni PR abierta equivalente entre #95, #96 y #97 consultadas.

Resultado: el cliente solicita revisión desde el flujo de compra; un oficinista autenticado abre una solicitud de su cooperativa, contrasta los documentos y registra la verificación. El comprador vuelve a solicitar su resumen autorizado. Acreditar no crea reserva, cobra, aprueba comprobante ni emite boleto.

## 2. Reglas y decisiones

Aplicar RN-02 y acuerdos de beneficios vigentes: edad al embarque, menor de 18 y tercera edad desde 65; porcentajes congelados por hoja, VIP antes del mayor beneficio elegible sin acumular y conservar empates. Esta pantalla no calcula descuentos ni cambia esos acuerdos.

El CLERK verifica identidad/nacimiento para fecha de nacimiento y documento acreditativo para discapacidad antes del total aceptado. Se conserva resultado, referencia privada de evidencia, actor, instante y versión. La verificación del comprobante de pago es posterior e independiente. No se realiza consulta pública de identidad por cédula ni se afirma verificación externa gubernamental.

Decisión técnica bajo delegación de Leslie: persistir solicitudes ligadas al contexto exacto de compra, en vez de pedir al oficinista que copie JSON/UUID del cliente o inventar una bandeja con datos de prueba. Mantener la API actual compatible; el nuevo comando toma propietario y pasajeros desde la solicitud persistida, nunca desde campos editables del oficinista.

## 3. Flujo y contrato previstos

### Cliente registrado

Crear solicitud autenticada CUSTOMER con CSRF. Entrada: tripId, fromPosition, toPosition, seatIds y passengers con los campos ya aceptados por compra, más requestKey de reintento. Propietario se deriva de Auth; cooperativa, viaje, asientos y vencimiento se validan con catálogo real en servidor. No aceptar ownerId, cooperativeId, precio o decisiones de acreditación como autoridad del body.

La clave de reintento se liga al propietario y huella del contexto canónico: repetición idéntica recupera la solicitud; misma clave con datos diferentes devuelve conflicto. La solicitud no bloquea asientos ni crea una reserva. Cambios de pasajero, asiento o tramo necesitan otra solicitud y otra acreditación; no alterar silenciosamente lo ya revisado.

El cliente consulta exclusivamente su solicitud para conocer estado y vencimiento; respuesta sin referencia de evidencia privada ni credenciales del oficinista. No admitir acceso por cédula, correo o requestId ajeno. Invitado se mantiene fuera de este incremento hasta su contrato propio.

### Oficinista

Bandeja paginada por cursor opaco de solicitudes de la cooperativa verificada de Auth. Resumen mínimo: requestId, viaje/tramo con etiquetas del servidor, createdAt, expiresAt, estado y número de pasajeros. No cédulas ni evidencias en la lista. El detalle autorizado presenta solo los pasajeros de la solicitud seleccionada: nombre, cédula, nacimiento y asiento/tramo; referencia privada de evidencia solo para el contexto de revisión autorizado.

Endpoints nuevos previstos bajo /api/v1/booking-benefit-requests:
- POST /: CUSTOMER crea/recupera solicitud idempotente.
- GET /: CLERK consulta su bandeja; no filtro de cooperativa elegido por navegador.
- GET /:requestId: CUSTOMER propietario consulta estado mínimo; CLERK de la cooperativa consulta detalle para revisar. Matriz explícita, sin permisos implícitos para administradores.
- POST /:requestId/review: CLERK, CSRF, entrada cerrada expectedRevision, decisiones por seatId y referencias privadas de evidencia. Identidades y datos del viaje provienen del registro y Auth.

Los endpoints nuevos están implementados localmente en B/C según §§10–13; la pantalla D sigue pendiente. El endpoint actual /booking-benefit-reviews sigue disponible con su alcance previo y no sustituye el nuevo GET ni la protección del comando.

## 4. Persistencia, revisión y recuperación

Una migración nueva añade solicitudes/auditoría necesarias sin editar migraciones existentes ni convertir historias automáticamente. Contexto canónico compatible con benefit-review-context y versionado explícito de solicitud. Estado PENDING o REVIEWED; vencimiento se deriva de expiresAt en servidor, sin mutación periódica obligatoria. expiresAt corresponde al embarque elegido; no prolongar por recargar/reintentar ni introducir vencimiento de pago de 3–5 minutos en esta fase.

Al revisar, bloquear la solicitud y verificar tenant, estado, revisión y viaje vigente; persistir decisiones en la fuente real que usa purchaseCatalog/benefitReviews, junto al resultado y auditoría, en una operación atómica. No marcar REVIEWED si falla guardar decisiones. Misma revisión/intención y contenido repite resultado; contenido distinto o versión antigua devuelve conflicto y obliga a recargar. No abrir una corrección sobre un resultado ya aceptado dentro de este primer incremento; nuevas revisiones serán un comando separado.

Una decisión falsa significa dato no acreditado, no rechazo del pago ni liberación de asientos. Conservar el requisito del backend que bloquea el total si la edad requerida no fue acreditada. No activar automáticamente las casillas para satisfacer ese requisito.

Evidencia: referencia interna opaca y privada asociada a documento presentado, tipo de documento y categoría verificada. No guardar fotografías como base64 ni rutas locales, URLs públicas, credenciales o imágenes en logs. Esta tarea no añade subida/visor de archivos ni promete almacenamiento digital de un documento que solo se examinó presencialmente. La validación del formato de referencia no demuestra autenticidad del documento; esa constatación corresponde al oficinista.

Timeout de revisión: mostrar «No pudimos confirmar el guardado», conservar intención solo en memoria y consultar detalle autorizado. Recuperar mismo resultado por clave/revisión, nunca mostrar éxito antes de respuesta confirmada ni reintentar con otra intención sin decisión del usuario. Sesión vencida elimina datos privados de la vista.

## 5. Pantalla y diseño aplicado

Aplicar expresamente frontend/DESIGN.md: marca transViaje, recursos locales existentes, Bootstrap 5 y tokens blanco/negro/violeta; sin CDN, dependencias nuevas ni modificación de tokens compartidos por conveniencia. Separar transporte, modelo/controlador y vista. Reutilizar frontend/src/api para cookies, CSRF y clasificación de errores.

Página prevista pages/acreditaciones.html, acceso CLERK verificado por /auth/me conforme al cliente existente. Vista de carga, lista vacía, error recuperable, bandeja y detalle. No ofrecer un selector de cooperativa ni requerir UUID/manual JSON en el recorrido del oficinista.

Formulario por pasajero con etiquetas explícitas, estado inicial sin verificar y controles para fecha de nacimiento y discapacidad, más la referencia de evidencia cuando se marca verificado. Botón «Guardar verificación», confirmación del contexto antes del envío, envío deshabilitado mientras guarda y resultado con hora/vencimiento del servidor. No llamarlo «Aprobar pago» ni «Reservar asiento».

No persistir PII en URL, localStorage/sessionStorage ni consola. Usar textContent para datos ajenos, limpiar detalle al cambiar sesión/solicitud y Cache-Control no-store en rutas privadas. No reemplazar autorización backend por ocultar un enlace.

## 6. Incrementos verificables

A. Este documento y evidencia de brechas/contratos, antes de código. Sin cambios funcionales.
B. Solicitud propia persistida y lectura autorizada por rol/tenant, con idempotencia y contexto real. Migración nueva y pruebas aisladas.
C. Guardado de verificación atómico/versionado, evidencia privada y recuperación de resultado incierto. Consumidor real de resumen sigue usando la fuente persistida; conservar API/pruebas anteriores.
D. Pantalla CLERK y acceso desde navegación autorizada; integración mínima del cliente para solicitar revisión. Frontend, backend, navegador y recorrido real de solicitar → revisar → obtener nuevo total.

B–D se autorizan/implementan por incrementos, con esta spec como referencia y sin publicar documentación aislada como funcionalidad completa. Una PR funcional puede reunir varios commits atómicos; no mezclar caja, invitado, boletos o historial.

## 7. Aceptación y comprobación

- Cliente solo crea/consulta solicitudes propias; CLERK solo ve su cooperativa; roles ajenos y CSRF ausente bloqueados. Ausente/ajena no distinguibles.
- El contexto proviene de catálogo real y del manifiesto validado. Otro pasajero o tramo no reutiliza acreditación. Repetición idéntica no duplica solicitud/decisión; carrera entre dos oficinistas tiene un solo resultado vigente.
- Error de catálogo/base no muestra vacío, acreditado o guardado. Rollback completo si falla una parte de revisión. Vencimiento al embarque se verifica en backend.
- Referencia de evidencia y PII visibles solo al rol/contexto permitido, sin almacenamiento de navegador ni logs. Payload hostil se presenta como texto.
- Teclado completo, foco visible y retorno al resultado/error; etiquetas vinculadas; estados escritos además del color; 360/1280 px y zoom 200 % sin perder acciones; contraste de texto al menos 4,5:1. Registrar QA real y sus límites, no afirmar certificación.
- Frontend lint/tests y escenarios de navegador. Si cambia backend: lint, format:check y npm test con PostgreSQL aislado; arranque real si cambia composición. No editar migraciones existentes, debilitar pruebas o ajustar timeouts para obtener verde.

## 8. Archivos y límites

Previstos: backend bookings domain/application/infrastructure/interfaces, migración nueva y pruebas; frontend pages/acreditaciones.html, src/bookings/benefits y pruebas; specs/evidencia/estado. Nombres técnicos reversibles sujetos al incremento; no importar capas privadas de otros módulos ni exponer repositorios.

Sin efectivo, corrección del comprobante, emisor de QR/correo, rol Chofer/Controlador o invitado. Sin nuevas dependencias. No tocar reglas académicas: PR #96 documental sigue separada. Sin commit/push/merge/rebase/tags hasta petición explícita.

## 9. Evidencia de preparación

API, repositorio y prueba commercial-purchase revisados en 46a96a2. Existe POST CLERK con autenticar/autorizar/CSRF, no-store y fechas de revisión; no hay GET de bandeja/detalle ni pantalla equivalente. Función review recibe ownerId del caller y contexto íntegro; las decisiones actuales son birthDateVerified/disabilityVerified y no registran referencia de evidencia. La fuente verify utiliza la última revisión del contexto y su vencimiento. Estos hechos delimitan los cambios, no acreditan implementación de B–D.

Revisión de PR accesibles: #95 registro cliente, #96 política documental, #97 recuperación de cuenta; no duplican acreditación. GUIDE/DESIGN consultados; no comandos ni dependencias de los documentos adjuntos ejecutados. Preparación solo Markdown, sin pruebas funcionales nuevas ni cambios de datos. Revisión humana de esta spec pendiente; no tarea integrada/cerrada.

## 10. Incremento B autorizado: solicitudes y lecturas

Leslie responde «listo sigamos con eso entonces» y autoriza B: crear una solicitud propia y consultar bandeja/detalle con fuente real, sin comando de revisión ni pantalla todavía. Base 46a96a2. No se considera implementado C/D por crear sus datos de entrada.

Decisiones técnicas de B bajo delegación: requestKey de 16–128 caracteres ASCII alfanuméricos, guion o guion bajo, ligado al propietario y huella SHA-256 del contexto canónico normalizado; datos equivalentes y orden distinto de pasajeros/asientos recuperan la misma solicitud. Se usa requestKey en body cerrado, no como credencial de lectura. Respuesta de creación 201, repetición 200, misma clave con otro contexto 409. El reintento idéntico puede recuperar una solicitud ya vencida sin volver a consultar catálogo ni extender el vencimiento. Sin coincidencia previa, catálogo y embarque se revalidan antes de insertar.

Solicitud persistida inmutable para B, estado almacenado PENDING/revision=1. Estado EXPIRED se proyecta cuando evaluatedAt >= expiresAt; no es liberación ni rechazo de una reserva. Nuevas revisiones y escrituras sobre decisiones no se añaden en B. La solicitud no acredita beneficios ni permite obtener total aceptado por sí sola.

GET de bandeja solo CLERK: limit predeterminado 20, máximo 100; cursor opaco = último requestId recibido, no credencial. Validar que el cursor pertenezca a la cooperativa del actor antes de usarlo. Orden createdAt DESC, id DESC. Lista mínima sin pasajeros, cédulas ni ownerId. GET de detalle: CUSTOMER propietario recibe solo metadatos/estado; CLERK de la cooperativa recibe además manifiesto y seatIds del contexto privado. Viaje/tenant se derivan del catálogo de servidor al crear; no se aceptan en cliente labels, fechas límite, identidad del comprador, precio o decisiones como autoridad.

Todos los endpoints autentican/validan rol y marcan no-store, incluido error JSON. Mutación requiere CSRF. GET rechaza campos adicionales y query de tenant/propietario. Ausente/ajena usa el mismo 404. Falta de catálogo o DB temporal genera 503 seguro, no bandeja vacía. Snapshot persistido incoherente genera 500 seguro. Sin permisos de administrador/invitado.

Persistencia nueva 1794280000000-booking-benefit-requests, al final del catálogo activo. Tabla propia sin FK a tablas privadas de Auth/Route Sheets: UUID de propietario/tenant/viaje verificados desde APIs/contexto confiable. Restricciones de scope, clave única de propietario/reintento, formato JSON/huella, fechas y revision=1 en esta fase. down con filas falla sin borrarlas. No editar migraciones anteriores ni escribir pgmigrations manualmente. Adaptar únicamente expectativas explícitas de catálogo de 30 a 31 y lista de tablas añadidas, conservando comprobaciones históricas e incorporando la nueva tabla; no debilitar pruebas ni límites.

Verificación B: unitarias de normalización, identidad, privacidad, cursor y recuperación; PostgreSQL/HTTP con Auth, catálogo y publicación reales, concurrencia de dos reintentos con una sola fila y ausencia total de reservas/ocupaciones. Migración: base vacía, conservación de filas anteriores al aplicar, down guardado con datos y rollback. Lint, format:check, npm test y arranque real; pruebas previas conservadas. Sin dependencia nueva, frontend, commit ni push.

## 11. Resultado local del incremento B

Implementados creador/recuperación de solicitudes propias, bandeja CLERK y detalle con privacidad por rol. Migración nueva y composición real en app/index de Bookings. [Contrato disponible](../contratos/solicitudes-acreditacion.md) y [evidencia](../evidence/BOOK-08/2026-11-04-solicitudes-acreditacion.md). Pruebas dirigidas de solicitudes 41/41 y migración/catálogo de integración 22/22 aprobadas; global aprobado: 2021 unitarias y 675 integraciones, 2696 pruebas/175 suites. Lint, formato y arranque real aprobados; health 200 y ruta sin sesión 401 con no-store. C/D no implementados. Revisión humana e integración pendientes; sin commit/push.

## 12. Incremento C autorizado: guardar verificación y recuperar resultado

Leslie solicita continuar tras B y autoriza C. Se conserva la rama y sus cambios locales; sin commit/push/merge. Fetch observa origin/develop 432ae27 (registro web y política documental avanzaron), mientras la base de esta rama sigue 46a96a2. No se rehace código remoto ni se atribuye su integración a esta rama; backend remoto no añade otro comando de acreditación.

### Contrato cerrado bajo delegación

POST /api/v1/booking-benefit-requests/:requestId/review, CLERK de la cooperativa y CSRF, JSON cerrado:

```js
{
  expectedRevision: 1,
  decisions: [{
    seatId,
    birthDateVerified: true,
    disabilityVerified: false,
    evidence: [{ kind: 'IDENTITY', reference: 'ref_expediente_0001' }]
  }]
}
```

Cada asiento del manifiesto persistido tiene una decisión exacta; no se reciben propietario, pasajeros, precio, viaje o tenant editables. expectedRevision es entero positivo; primera revisión requiere revisión 1/PENDING y produce revisión 2/REVIEWED. No hay reapertura/corrección de una solicitud revisada en C.

Evidencia por decisión: array de hasta dos objetos cerrados kind/reference; kind IDENTITY o BIRTH_RECORD para nacimiento, DISABILITY para discapacidad. Fecha verificada exige exactamente un documento de edad; discapacidad verificada exige exactamente uno de discapacidad. Categorías no verificadas no llevan evidencia correspondiente. Tipos duplicados o dos documentos de edad son inválidos. reference usa prefijo ref_ y entre 4–124 caracteres ASCII alfanuméricos/guion/guion bajo después del prefijo, sin espacios, URLs, rutas o texto de documento. Es referencia privada al documento presentado, no carga de archivo, prueba automática de autenticidad ni cédula como credencial. Ningún control se marca verificado por defecto.

Idempotencia: huella SHA-256 de requestId, actor verificado, tenant, expectedRevision y decisiones/evidencias canónicas ordenadas. Repetición idéntica del mismo actor recupera resultado persistido aun tras vencer el plazo, sin insertar otra acreditación. Actor, versión o contenido diferentes no son el mismo intento y generan BOOKING_BENEFIT_REVIEW_CONFLICT/409. No se conserva sid ni sesión del cliente/oficinista como credencial durable; cada reintento HTTP se autentica de nuevo.

### Atomicidad y consulta comercial

Obtener el snapshot autorizado, verificar su huella/contexto y consultar el catálogo real antes de adquirir la conexión transaccional. Evita que muchos revisores mantengan conexiones bloqueadas y esperen una segunda conexión del mismo pool. Después SELECT FOR UPDATE relee la solicitud por id/cooperativa y verifica identidad, contexto inmutable, estado/revisión e instante de vencimiento. La consulta comercial no bloquea módulos ajenos ni reserva asientos; el resumen/creación posteriores vuelven a validar viaje/precio/inventario conforme a su contrato. No se promete serializar cambios de frecuencia con esta acreditación.

Bajo la misma transacción: insertar las decisiones de tres campos en booking_benefit_reviews (fuente real usada por el resumen); guardar en la solicitud el resultado 2/REVIEWED, actor, fecha, versión de entrada, huella de intención, decisiones con evidencia privada e identificador de acreditación. El UPDATE exige también no haber alcanzado expiresAt usando reloj PostgreSQL. Fallo de cualquier escritura revierte ambas; no se entrega éxito antes de COMMIT. COMMIT con resultado perdido/incierto produce BOOKING_BENEFIT_REVIEW_UNCERTAIN/503 y se recupera con el mismo intento; no se rechaza ni libera reserva automáticamente.

Migración nueva 1794290000000-booking-benefit-request-reviews, posterior a B, sin modificar migraciones previas. Añade columnas privadas y restricciones/trigger que hacen inmutable el contexto inicial y un resultado ya revisado. Se guarda la referencia al registro de acreditación desde la transacción sin FK que acople las operaciones históricas de limpieza de ambas tablas; no es autorización para borrar acreditaciones. La API anterior de revisión conserva su comportamiento y auditoría, y el verificador real continúa leyendo la última acreditación de su contexto. No se afirma que C invalide o serialice decisiones posteriores del endpoint legado.

GET/list siguen no-store. Metadata añade reviewedAt si corresponde. GET de propietario permite ver solo decisiones de sus asientos sin referencias privadas, identidad del oficinista o identificador interno de acreditación. CLERK propio recibe además evidencia y actor en detalle, nunca en bandeja. EXPIRED se proyecta si vence expiresAt, conservando la revisión histórica y su fecha. REVIEWED no equivale a beneficio concedido: fecha no verificada mantiene bloqueado el total, sin rechazo de pago ni liberación.

### Comprobación C

Probar fecha/discapacidad y evidencia completa/inválida; aislamiento/CSRF; nueva revisión y repetición sin duplicados; contenido/actor/revisión distintos; dos oficinistas simultáneos; rollback entre inserción y actualización; pérdida de respuesta después de COMMIT y recuperación; vencimiento y límite exacto; fuente real de resumen que aplica o bloquea según decisiones. Unitarias, PostgreSQL/HTTP con proveedores reales y prueba de migración con filas B preservadas, down protegido y contexto/resultado inmutables. Adaptar únicamente pruebas propias que esperaban revisión inexistente y reversiones por nombre al haber una migración posterior, conservando sus garantías.

C no implementa todavía la pantalla D, subida digital de documentos, invitado, caja, correcciones de pago o envío de boletos. No dependencias nuevas ni cambios a timeouts para obtener verde. Repetir lint, format:check, npm test y arranque real; registrar todos los resultados y revisión humana pendiente.

## 13. Implementación local de C

Guardado de revisión CLERK implementado con evidencia privada y versión, recuperación por intención, transacción real y protección de contexto/resultado finalizado. El propietario recibe solo sus decisiones; CLERK autorizado ve evidencia en detalle y no en bandeja. La fuente real permite obtener el resumen o mantiene la revisión requerida según el resultado; no crea reserva ni ocupa asientos. [Contrato B/C](../contratos/solicitudes-acreditacion.md) y [evidencia C](../evidence/BOOK-08/2026-11-04-revision-acreditacion.md). Validación final: lint y format:check global aprobados; npm test aprobado con 2049 unitarias y 686 integraciones (2735 pruebas, 177 suites). Arranque real: health 200, listado y revisión sin sesión 401 con no-store, cierre ordenado. Diff revisado, sin cambios a migraciones anteriores ni timeouts. Sin commit/push, pantalla D y revisión humana pendientes.

## 14. Publicación autorizada

Leslie solicita expresamente crear commit y hacer push de B/C en feature/BOOK-08-acreditacion-web. Se conserva la validación final anterior: no hay cambios funcionales posteriores. Publicación no equivale a revisión humana, pantalla D o integración.
