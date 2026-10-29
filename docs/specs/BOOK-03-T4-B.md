# BOOK-03 T4 B: pantalla de reservas y recuperación al recargar

- Responsable: Leslie Coello. Revisor propuesto: PabloToapanta.
- Fecha: 29 de octubre de 2026. Spec previa al código; Leslie autoriza continuar con la pantalla.
- Rama existente feature/BOOK-03-resumen-creacion-dominio, base fb1cdd7. Una entrega funcional futura hacia develop, con un commit por tarea (consulta de recuperación y pantalla); no publicar un PR por paso.
- Referencias: T4 A, T3-R, RN-02/40/42/43/50, frontend/DESIGN.md, GUIA-INTEGRACION.md y calidad.md.

## A. Consulta del resultado de creación

Añadir GET /api/v1/bookings/attempts/:requestKey, con sesión CUSTOMER, validación UUID v4 y Cache-Control no-store. Identidad verificada por el mismo adaptador de T4 A. No aceptar propietario ni cooperativa del cliente. PgBookingRepository.findByCreationRequest({ownerId,requestKey}) filtra por ambos valores y devuelve la reserva privada actual o null, sin consultar catálogo/acreditación ni escribir. Solo propio comprador registrado; no autoriza operaciones internas por cooperativa ni acceso por clave sola.

Caso de uso getBookingAttempt resuelve comprador y lanza BOOKING_ATTEMPT_NOT_FOUND (404) si no existe para ese dueño. Clave desconocida y de otro dueño tienen la misma respuesta. Un 404 significa que no hay un resultado visible en esa consulta; no demuestra que una solicitud original todavía en curso haya fallado. No reactivar, prorrogar ni recalcular una reserva consultada. Este GET evita persistir el cuerpo con datos personales para recuperar después de recargar.

Pruebas unitarias y HTTP reales: sesión/rol, clave inválida, compra propia recuperada sin proveedores, otro dueño/clave desconocida indistinguibles, ninguna escritura, fechas conservadas.

## B. Página y contrato de entrada

Crear frontend/pages/reservas.html y módulos propios en frontend/src/bookings. Aplicar DESIGN.md: tokens y tipografía locales, paleta blanco/negro/violeta, superficies/botones y foco visible; adaptar D-01 a flujo de compra, no copiar panel conceptual de portada. Usar Bootstrap existente. Añadir solo CSS de componentes bajo .booking-page al app.css existente; no duplicar estilos globales ni tocar vendor.

Entrada desde futura búsqueda: query tripId/fromPosition/toPosition (sin datos personales). Si falta o no es válida, mostrar orientación y enlace real al inicio; no pedir IDs técnicos ni simular viajes. No modificar navegación de la portada ni inventar login/búsqueda/pagos todavía no disponibles.

Consumir el transporte JSON compartido sin editarlo ni crear otro mecanismo de fetch/CSRF. Adaptador de reservas añade Idempotency-Key mediante fetchImpl inyectado del transporte; cookies/errores/JSON siguen siendo del cliente común. Obtener CSRF de auth antes de cada POST; no repetir mutaciones automáticamente. 401 informa que hace falta sesión de cliente sin enlaces inexistentes; 503 informa indisponibilidad. El servidor actual no tiene proveedores reales y no se presenta compra habilitada.

Estados visibles: carga, falta de viaje, sesión requerida, vacío, error y recuperación; lista de asientos (no dibujar distribución/pisos inexistentes), selección por botones aria-pressed, formularios de pasajero por asiento, resumen del servidor, aceptación explícita, confirmación y reserva creada con plazo del servidor. No confiar en selección/validación de navegador para autorizar ni recalcular descuentos/tarifas.

Pasajeros: nombre completo, cédula de diez dígitos y fecha de nacimiento, con etiquetas. Mantener borradores solo en memoria al corregir/actualizar asientos; no logs ni persistencia de cuerpos/documentos. Crear contenido con textContent/nodos, no HTML de la API.

## Intentos, estado y recuperación

Guardar en sessionStorage únicamente el UUID del intento antes del primer POST de creación; nunca nombre/cédula/fecha, token CSRF o cookie. Generar UUID v4 con crypto.randomUUID una vez por intento. Si no se puede guardar/leer la referencia de forma segura, informar y no iniciar otra confirmación automáticamente.

Durante envío o resultado desconocido, impedir edición y compras adicionales; ofrecer consultar resultado por GET y reintentar explícitamente la misma clave/cuerpo si siguen en memoria. 5xx, red y respuesta no válida de creación se tratan conservadoramente como resultado desconocido; no asumir que no se guardó. El cliente común normaliza 5xx, por eso no depender de códigos de proveedor en ese estado.

Al recargar, si existe referencia, consultar el GET protegido antes de permitir otra compra. Si aún no hay resultado, conservar referencia y no afirmar fracaso; ofrecer nueva consulta. No reintentar POST sin cuerpo original ni pedir al usuario reconstruirlo. Una recuperación 201/GET propio muestra datos/fechas persistidos; el estado no se reinicia.

Si el resultado es conocido y definitivo (p. ej., validación, cambio de resumen, conflicto de asientos), permitir corregir; no crear otra clave silenciosamente después de resultado desconocido. Cambio de resumen invalida aceptación; un nuevo resumen requiere nueva aceptación. Misma clave vinculada a otros datos requiere revisión y no genera otra compra automática. Tras éxito, acción explícita Finalizar y volver al inicio puede retirar solo la referencia de esta página.

El plazo es expiresAt del servidor; contador orientativo y nunca expirar/liberar/vender en navegador. Si llega a cero no declarar estado expirado sin respuesta del servidor. Pagos siguen en su entrega; no inventar botón de pago ni boleto emitido.

## Pruebas y empaquetado

- Unidad Node test sin dependencias nuevas: adaptador usa cliente común, CSRF/cookies y cabecera de reintento; lectura de query, estado/referencias y tratamiento de errores sin duplicación.
- Navegador Chrome/Chromium de pruebas con backend real, PostgreSQL/JWT/CSRF reales; catálogo/acreditación solo fixtures explícitas. Guardado, timeout simulado de respuesta con COMMIT real, consulta tras recarga, bloqueo de doble envío, cambio de resumen, datos conservados y 401/503/entrada vacía. Nunca usar fixture en server.js o HTML.
- Teclado: enlace de salto, selección/acción con Tab/Enter, foco visible, etiquetas; avisos aria-live y cambios de paso con foco. 360/1280 px, contenido ampliado al 200%, sin desbordamiento; registrar si zoom nativo/ayudas técnicas no pudieron verificarse. Verificar contraste de texto normal >=4.5:1 y no depender solo del color.
- Capturas de QA con datos sintéticos en carpeta temporal, inspección visual y correcciones. No mostrar screenshots con personas reales.
- Actualizar Dockerfile/.dockerignore con inclusión exacta de página/módulos/API compartida. Probar imagen real en puerto/proyecto exclusivo y MIME de archivos; conservar exclusiones de docs/tests/secretos, sin fallback a index.html. No alterar pruebas anteriores.
- Ejecutar tests/lint frontend y backend; PostgreSQL exclusivo, sin .env, registrar resultados reales y retirar recursos propios.

Pantalla implementada no acredita proveedores reales ni aprobación humana. La activación de compra real continúa pendiente de viajes/plantillas y acreditación/revisión asistida, además de revisión de la entrega completa.


## Evidencia A — consulta de recuperación, 29 de octubre de 2026

Implementado GET /api/v1/bookings/attempts/:requestKey y el caso de uso getBookingAttempt. El repositorio filtra por owner_id verificado y clave UUID, sin catálogo ni escritura. Ausencia/otro propietario producen el mismo 404; no se interpreta como fracaso definitivo de una solicitud en curso.

Siete pruebas unitarias nuevas y tres HTTP nuevas aprobadas. Suite completa: 773 unitarias + 188 integración = 961 pruebas. Lint aprobado; formato de archivos de A aprobado, formato global conserva 24 archivos preexistentes ajenos. Sin migraciones/dependencias nuevas ni eliminación de pruebas. Se usa base temporal nueva busesuta-leslie-book03-pantalla, cero tablas antes de migrar; se conserva activa para comprobar la pantalla y se retirará al terminar.

A completa localmente; B en implementación y todavía sin prueba de navegador. No se declara compra de producción ni revisión humana.
