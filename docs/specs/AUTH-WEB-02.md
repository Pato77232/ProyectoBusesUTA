# AUTH-WEB-02: pantalla de registro de clientes

- **Responsable:** Pablo.
- **Revisora propuesta:** Shirley; aceptación y revisión pendientes.
- **Estado:** En desarrollo; Pablo confirmó las decisiones de flujo el 4 de noviembre de 2026.
- **Base:** `origin/develop` `5ff50d9`; rama `feature/AUTH-WEB-02-registro-cliente`.
- **Dependencias:** AUTH-04 (endpoint integrado), FRONT-01 y AUTH-WEB-01.

## Objetivo y alcance

Permitir que una persona cree una cuenta CUSTOMER desde una página pública. La
pantalla envía solo correo y contraseña a `POST /api/v1/auth/register` usando el
cliente HTTP compartido y CSRF. Un 201 confirma la creación y lleva al login
con el correo precargado; la contraseña nunca se transfiere. El registro no
inicia sesión automáticamente.

No incluye cambios de backend, recuperación de contraseña, verificación de correo,
registro de personal/cooperativas ni sesión automática. Aplica RN-01/02,
`docs/calidad.md` y `frontend/DESIGN.md` (D-02/03/04/07): identidad transViaje,
etiquetas, foco, mensajes y reflujo. La referencia visual no añade campos.

## Contrato y criterios

- Correo obligatorio, formato de correo y máximo 254 caracteres; el servidor
  normaliza. Contraseña obligatoria de 15–128 puntos de código Unicode, sin trim.
- El formulario pide confirmar la contraseña y compara ambas sin modificar los
  caracteres. La confirmación se valida localmente y no se envía al servidor.
  Permite pegar y usar gestores de contraseñas. No almacena contraseñas ni
  registra credenciales. Limpia ambos campos secretos tras cada intento.
- El correo precargado viaja una sola vez mediante `sessionStorage`, no en la
  URL. Se elimina al abrir el login. Si el almacenamiento falla, el login sigue
  disponible sin precarga.
- Si la persona llega desde la pantalla de reservas, el retorno conserva solo
  la ruta local `/pages/reservas.html` y, si existe, el contexto de viaje
  permitido. Tras `auth/me` confirmado se vuelve allí. Se rechazan rutas
  externas, fragmentos y parámetros inesperados. No se conserva el formulario
  ni se promete mantener asientos o precios al salir de la página.
- Impide envíos simultáneos. Envía únicamente `{email, password}`. No solicita
  rol ni cooperativa; backend asigna CUSTOMER sin cooperativa.
- 400 muestra validación sin eco de datos sensibles; 403 solicita nuevo intento
  explícito; 409 muestra el mensaje genérico del contrato sin revelar cuentas.
- Ante red, 5xx o respuesta ilegible, comunica que el resultado es incierto y
  pide comprobar la cuenta mediante el inicio de sesión. No reintenta el POST.
- La página y módulos se sirven desde la imagen web. Se prueban teclado, foco,
  texto de estado y tamaños móvil/escritorio.

## Plan y evidencia

1. Crear página, controlador y vista con pruebas dirigidas.
2. Conectar navegación y empaquetado; comprobar el flujo con API real.
3. Ejecutar lint, formato y pruebas; registrar resultados reales aquí y en
   `docs/estado-proyecto.md`. Solicitar revisión humana antes de cerrar.

Sin defecto inducido en este incremento. No modifica RN ni migraciones.

## Verificación local del 4 de noviembre de 2026

- La suite frontend final pasó 331/331 pruebas (12 nuevas); `npm run lint`
  frontend completo aprobó.
- Prettier de los archivos nuevos y `git diff --check`: aprobados.
- La imagen frontend final construyó. Chrome, con API simulada solo para esta
  comprobación, recorrió registro 201, login con correo precargado y retorno a
  reservas con contexto de viaje permitido. La revisión visual móvil/escritorio
  de esta pantalla queda pendiente.
- El smoke de portada existente aprobó escritorio, móvil, teclado, destinos y
  zoom CSS 200 %. No certifica zoom nativo ni lector de pantalla.
- Comprobación adicional con PostgreSQL 16.13, backend y Nginx reales en un
  entorno efímero: se montó una copia temporal de la cabeza `1eb0210` de PR #94
  (hotfix propuesto, aún no integrado) junto con los archivos de esta pantalla.
  Chrome recorrió reservas → registro 201 → login con correo precargado, verificó
  `auth/me` 401 antes del login y 200 después, y volvió a reservas. Health y
  página respondieron 200; los tres servicios permanecieron saludables. Datos
  QA aleatorios, sin `.env` ni credenciales reales. Esta prueba acredita la
  combinación temporal, no el arranque de `main`/`develop` actuales.
- Backend `npm run format:check`: aprobado. `npm run lint` falla por una
  declaración duplicada de `payments` en `backend/src/server.js` de la base
  `5ff50d9`, fuera del alcance de esta pantalla. `npm run test:unit` con las
  dependencias preexistentes enlazadas aprobó 1930 pruebas, pero tres suites no
  cargaron por `nodemailer` ausente y la sintaxis de `server.js`; `npm test`
  también falla en la fase unitaria, sin llegar a integración. No se declara
  la suite completa aprobada.

Implementación local sin publicación, revisión humana ni integración.
