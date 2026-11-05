# OPS-WEB-01: acceso a operaciones de cooperativa

- **Módulo:** frontend operativo
- **Base local:** `feature/AUTH-WEB-01-cierre-sesion-cambio-cuenta`, commit `1f15756`
- **Estado:** implementación local completa el 4 de noviembre de 2026; revisión humana e integración pendientes.
- **Referencias:** RN-01/RN-02, AUTH-WEB-01, FLEET-02, FREQ-01, ROUTE-SHEETS-WEB-01 y `frontend/DESIGN.md`.

## 1. Objetivo

Dar a `COOPERATIVE_ADMIN` una entrada visible a las pantallas operativas ya
existentes. Después de iniciar sesión, el enlace de administración de este rol
debe abrir un menú con accesos a flota, frecuencias, hojas de ruta y creación
de oficinistas.

## 2. Alcance

Incluye:

- Sustituir en el login el destino único «Crear oficinistas» por
  «Operaciones de cooperativa».
- Crear `/pages/operaciones-cooperativa.html` con enlaces a:
  - Registrar bus: `/pages/registrar-bus.html`.
  - Crear/consultar frecuencias: `/pages/crear-frecuencia.html` y
    `/pages/frecuencias.html`.
  - Consultar/crear borradores de hojas de ruta:
    `/pages/hojas-ruta.html`.
  - Crear oficinistas: `/pages/oficinistas.html`.
- Comprobar `GET /api/v1/auth/me` antes de mostrar los enlaces y aceptar
  únicamente una identidad `COOPERATIVE_ADMIN` válida. El backend mantiene
  la autorización definitiva de cada operación.
- Empaquetar la página y el módulo mínimo necesario en la imagen Nginx y
  permitir su inclusión mediante `.dockerignore`.
- Agregar pruebas frontend para autorización y estados de acceso.

No incluye crear grupos de buses, inventario de buses, pantallas nuevas de
Flota/Frecuencias/Hojas de Ruta, altas de cooperativas ni cambios backend.
Registrar un bus sigue necesitando un grupo existente; el menú debe explicar
esta limitación para no presentar el flujo como completo.

## 3. Diseño y usabilidad

Adoptar `frontend/DESIGN.md`: recursos locales, tipografía/colores/tokens
existentes, enlaces reales, foco visible, encabezados semánticos y reflujo
móvil. No añadir dependencias ni modificar estilos globales. La autorización
fallida debe mostrar un mensaje comprensible y una salida al login.

## 4. Aceptación

- Dada una sesión confirmada `COOPERATIVE_ADMIN`, el login ofrece el panel
  operativo y el panel presenta solo los destinos del alcance.
- Dada una sesión ausente, expirada o de otro rol, no se muestran los enlaces
  operativos; se distingue entre sesión vencida y acceso denegado cuando la
  respuesta lo permite.
- Los enlaces apuntan a páginas incluidas en la imagen actual; no se presenta
  como disponible el inventario aún no empaquetado.
- La página advierte que registrar buses requiere un grupo existente.
- El frontend mantiene sus pruebas, lint y empaquetado.

## 5. Verificación

Desde la raíz, ejecutar lint y pruebas frontend con las dependencias ya
instaladas. Comprobar que la imagen Nginx sirve el panel y sus recursos; si
Docker está disponible, verificar los enlaces HTTP y el health del entorno
temporal. Registrar resultados y límites en `docs/estado-proyecto.md`.

## 6. Evidencia local

- `node --test frontend/tests/admin/operations-controller.test.js frontend/tests/auth/operations-navigation.test.js`: 5/5 pruebas aprobadas.
- `npm --prefix frontend test`: 366/366 pruebas aprobadas.
- `npm --prefix frontend run lint`: aprobado.
- Prettier `--check` sobre los archivos modificados: aprobado.
- `docker build -t transviaje-ops-web-01 frontend`: aprobado; la nueva página se incluyó en la imagen.
- `npm --prefix frontend run test:admin`, con `BROWSER_BIN` apuntando a Chrome instalado: recorrido QA con Docker, API y PostgreSQL aislados aprobado. Confirmó destino del login, autorización del panel, enlaces HTTP 200, limitación del grupo de buses, creación de oficinista, rol denegado y reflujo a 360 px.
- El entorno de QA se retiró al terminar. No se detuvo el entorno de desarrollo del usuario ni se modificó el backend.

No se implementó la creación de grupos ni el inventario de buses. La cuenta
`COOPERATIVE_ADMIN` requiere pertenencia a una cooperativa existente. Sin un
grupo previo, el alta del bus no se puede completar desde esta interfaz.
