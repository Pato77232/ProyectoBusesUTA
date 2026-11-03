# PAGOS-WEB-01 — evidencia de verificación

Fecha: 2 de noviembre de 2026, America/Guayaquil.
Responsable: Shirley. Asistencia de IA: implementación, pruebas y documentación.
Revisión humana de Pablo pendiente; no implica aprobación ni integración.

## Base y separación

- Rama preparada: feature/PAGOS-WEB-01-bandeja-pr.
- Base: origin/develop 5abc36de0e4c7e669e371d8cf3045cf790cb8802, comprobada mediante fetch.
- Copia de trabajo administrada: pagos-web-bandeja/ProyectoBusesUTA.
- Conserva página, módulos, estilos y comandos de Frecuencias integrados en PR #50.
- La carpeta original conserva sus cambios y borradores previos intactos. No se copiaron los borradores de caja/correcciones, conciliación del lector o evidencia histórica pendiente de guardar.
- Sin commits, staging, push, merge, rebase, tags, envío de mensajes o PR publicada.

## Resultados finales sobre la base actualizada

| Verificación | Resultado real |
|---|---|
| Frontend npm test | 168 aprobadas, 0 fallidas (24 nuevas de Pagos) |
| ESLint frontend | Aprobado, incluidos módulos/pruebas nuevos y Frecuencias |
| Formato de archivos propios | Aprobado usando backend/.prettierrc.json |
| Backend npm run lint | Aprobado en imagen Node 24 con reglas actuales |
| Backend npm run format:check | Fallido: 17 archivos previos de Hojas de ruta/migraciones; no modificados |
| Backend npm test | 1298 unitarias y 372 integraciones aprobadas, 1670 total; 72+29 suites, salida 0 |
| Imagen frontend/backend | Reconstruidas desde Dockerfile actual; sin dependencias nuevas |
| Arranque real server.js | Salud 200; listado y archivo sin sesión 401 con no-store |
| git diff --check | Aprobado |

Dependencias exactas del lockfile en Node 24.21.0; imagen QA existente con SHA256 de package-lock.json ff79ebd7b1dcd47b2b584177215bc7f388e77a9ca924e69d951f8a45402006f3, idéntico al repositorio. Código, pruebas, migraciones y configuración Jest montados explícitamente en solo lectura. PostgreSQL 16.13 efímero, red exclusiva, base pagos_web_test y credenciales ficticias. No se montó ni leyó .env.

## Navegador, proxy y permisos

`npm --prefix frontend run test:payments` reconstruye las imágenes del repositorio, prepara tres cooperativas ficticias y cuentas QA, y usa Chrome efímero. En Windows detecta la ruta habitual; BROWSER_BIN permite otra instalación. Requiere Docker Desktop y Node con WebSocket disponible. QA_OUTPUT_DIR permite elegir dónde guardar capturas. PAYMENTS_QA_API_IMAGE/PAYMENTS_QA_FRONTEND_IMAGE permiten reutilizar imágenes verificadas.

Comprobaciones aprobadas:

- Sin sesión ofrece acceso al login y no solicita listado; CUSTOMER y COOPERATIVE_ADMIN quedan denegados antes de solicitarlo.
- CLERK recibe 50+1 registros de su cooperativa con anterior/siguiente; actualizar conserva la página actual. Enter activa paginación; Tab alcanza archivos y el foco es visible.
- Segunda cooperativa ve solo su comprobante. Acceder al archivo de la otra devuelve 404.
- Archivo privado devuelve PNG real y Cache-Control no-store. La ruta de apertura usa pestaña nueva con noopener/noreferrer.
- Nombre con marcado HTML se presenta literalmente sin crear imágenes/scripts. Nombre largo no desborda; USD cero no se convierte en total ausente.
- Bandeja vacía se distingue de error. Al detener la API se eliminan resultados visibles y se ofrece reintento explícito.
- No hay persistencia en localStorage/sessionStorage ni peticiones externas del navegador.
- Imagen sirve página, módulos, CSS, login y registro de bus; scripts/fixtures QA devuelven 404.
- Anchos 1280 y 360, texto al 200 % en viewport reducido: sin desplazamiento horizontal. Capturas de escritorio/móvil inspeccionadas; no sustituye prueba de usabilidad con otra persona.

El servidor QA monta Auth y Payments reales con PostgreSQL/archivos reales. Solo las reservas se inyectan en el lector simulado ya existente. No acredita integración productiva con Bookings, carga real, venta, QR, correcciones o caja.

## Intentos anteriores y límites

La ejecución Windows original falló por EACCES HTTP y busboy ausente. Una primera ejecución Docker omitió jest.config.js y registró un timeout de fotos de Fleet bajo el límite por defecto; se repitió con la configuración original, sin alterar pruebas ni límites, y aprobó. En la base anterior c1d638f pasaron también 1173 unitarias y 293 integraciones. Esos resultados no reemplazan la comprobación final de 5abc36d.

La prueba de navegador detectó dos mejoras: Cache-Control no-store en respuestas privadas y foco visible específico de botones frente a Bootstrap. Se corrigieron con pruebas conservadas. También se corrigieron detalles del lanzador QA (red/puerto y sesión al navegar); los fallos iniciales no se presentaron como aprobados.

Revisión humana, CI remoto, publicación y aprobación siguen pendientes. El formato global continúa fallido. No se introdujeron defectos académicos por iniciativa propia.

## Capturas QA

- [Escritorio, 1280 px](escritorio.png).
- [Bandeja móvil, 360 px](movil.png).

Los identificadores, nombres y cuentas de estas capturas son sintéticos.
