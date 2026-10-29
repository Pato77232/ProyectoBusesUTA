# Pantalla de reservas — BOOK-03 T4 B

Ruta: /pages/reservas.html. Requiere servidor HTTP del frontend, API del mismo origen y sesión CUSTOMER. No se añadió un enlace de compra a la portada ni una página de login/búsqueda ficticia.

La futura búsqueda debe abrir la página con tripId/fromPosition/toPosition reales en la query. Sin contexto válido, se muestra orientación y un enlace al inicio. Sin sesión, informa que se necesita acceso de cliente; sin catálogo real, muestra indisponibilidad y permite volver a consultar. Actualmente los proveedores de viajes/plantillas/acreditación siguen pendientes: esta página no activa compras reales por sí sola.

## Recorrido y decisiones

- Lista de asientos recibida de la API, sin inventar pisos ni distribución física del bus. Botones con texto/estado y aria-pressed; selección y datos conservados en memoria al corregir.
- Un pasajero por asiento: nombre, cédula y nacimiento con etiquetas y validación básica de formato. Las reglas, descuentos, acreditación y precios permanecen en backend.
- Resumen privado del servidor, con total USD y revisión. Aceptación explícita antes de confirmar; un cambio de tarifa pide nuevo resumen y aceptación.
- Una sola referencia UUID en sessionStorage antes de enviar. Nunca pasajeros, cédulas, tokens CSRF o cuerpos privados. Mientras el resultado es desconocido se bloquea otra compra; permite consultar el resultado o reenviar explícitamente el mismo cuerpo si aún está en memoria.
- Al recargar, se consulta GET /api/v1/bookings/attempts/:requestKey. Un 404 conserva la referencia y no afirma que una creación en curso falló. No se reconstruye el POST a partir de datos privados guardados.
- La reserva creada muestra referencia, estado y expiresAt del servidor. El contador es orientativo y no expira/libera/vende en navegador. Finalizar y volver al inicio retira solo la referencia, tras éxito.

El adaptador usa createJsonTransport existente, añade Idempotency-Key sin cambiar el transporte común y obtiene CSRF de auth antes de cada POST. No hay reintentos automáticos de mutaciones. El componente usa textContent/nodos para los datos de la respuesta.

## Diseño y empaquetado

Adopta DESIGN.md: marca, recursos y tipografía locales, blanco/negro/violeta y tokens existentes. CSS de componentes bajo .booking-page en app.css; la portada conserva su navegación. No hay dependencias nuevas.

Dockerfile/.dockerignore incluyen únicamente la página, los tres módulos propios y los dos archivos API comunes necesarios. Las pruebas del contenedor verifican MIME, usuario nginx, rutas reales y exclusión de tests/documentos/configuración sensible, sin fallback global.

El comando de lint del frontend se ejecuta con Node para funcionar también en Windows; la configuración nueva se limita a archivos/pruebas de reservas.

## Repetir verificaciones

Desde frontend con Node 24 y las dependencias ya instaladas del backend:

- npm test: transporte común y lógica de reservas.
- npm run lint.
- npm run test:bookings:container: imagen real, puerto y red exclusivos, retirados al terminar.
- npm run test:bookings:browser: Chrome headless + backend/PostgreSQL/JWT/CSRF reales. Requiere una base temporal propia conforme a docs/testing-database.md, NODE_ENV=test y DATABASE_URL terminada en _test. Usa datos ficticios y reinicia las tablas de fixtures; nunca usar base de desarrollo.
- En Windows, BROWSER_BIN puede indicar la ruta de chrome.exe. QA_OUTPUT_DIR define dónde guardar capturas locales; no se versionan ni incluyen tokens.

La prueba de navegador usa catálogo/acreditación explícitamente ficticios solo en su servidor QA, sin modificar server.js. Pierde el 201 después de COMMIT mediante un proxy de prueba que responde 502, verifica una sola fila y recupera por GET al recargar.

Evidencia: BOOK-03-T4-B.md. Verificado en Chrome headless Windows a 360/1280 px, teclado para selección y acciones, foco, contraste de muestras >=4.5:1 y ampliación CSS al 200%. Zoom nativo, lector de pantalla, dispositivos reales y revisión humana siguen pendientes; no se certifica conformidad de accesibilidad.
