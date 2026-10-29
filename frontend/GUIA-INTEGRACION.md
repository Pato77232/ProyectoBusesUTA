# Guía del equipo: usar la base de transViaje

Alcance: FRONT-01 T2, para Pablo, Edwin, David, Leslie y Shirley. T1 está integrada; T2 está preparado localmente para revisión. Esta guía no autoriza pantallas nuevas. [Spec](../docs/specs/FRONT-01.md), [guía visual](DESIGN.md) y [revisión/evidencia de T2](../docs/revision-FRONT-01-T2.md).

## 1. Levantar la portada y API reales

Desde la raíz del repositorio, con Node 24 y Docker/Compose disponibles:

```sh
node frontend/scripts/dev.cjs up
node frontend/scripts/dev.cjs status
```

Abrir http://127.0.0.1:8081/. La portada sigue indicando las funciones futuras. Abrir http://127.0.0.1:8081/api/v1/health: resultado esperado, HTTP 200 y JSON `{"status":"ok"}`. Eso comprueba conexión con backend/DB, no que reservas, pagos u otras pantallas estén implementados.

El lanzador construye imágenes con sus dependencias existentes, inicia DB aislada, aplica migraciones y espera los servicios. Las credenciales locales son aleatorias y permanecen en memoria/entorno de los contenedores; el archivo temporal de configuración está vacío. No necesita leer .env real. No copiar salidas de inspección completa o Compose renderizado, que pueden contener valores de ejecución.

La base usa tmpfs: sus datos se descartan al retirar el servicio. No guardar trabajo o información real que se quiera conservar. Para detener y limpiar este proyecto:

```sh
node frontend/scripts/dev.cjs down
```

Las imágenes quedan en caché. Si up informa que el entorno ya existe, usar status; para un nuevo arranque con credenciales nuevas, hacer down antes de up. No cambiar manualmente contraseñas de una instancia ya iniciada.

Para usar 8082, en POSIX:

```sh
FRONTEND_DEV_PORT=8082 node frontend/scripts/dev.cjs up
```

En PowerShell:

```powershell
$env:FRONTEND_DEV_PORT = '8082'
node frontend/scripts/dev.cjs up
```

Linux fue comprobado; Windows/Docker Desktop y ayudas técnicas siguen sin prueba. Solo frontend publica en loopback; backend y DB quedan internos. Este entorno HTTP es de desarrollo; producción mantiene sus políticas Secure/HTTPS.

## 2. Elegir el modo de comprobación

| Necesidad | Cómo comprobar | Qué acredita |
|---|---|---|
| Revisar solo apariencia/teclado | Servidor Python de [README.md](README.md) | Portada estática, sin API |
| Verificar imagen estática de T1 | `node frontend/tests/container-smoke.cjs` | Empaquetado, MIME, exclusiones, 404 y API 503 explícita del modo estático |
| Probar conexión real | `node frontend/tests/proxy-smoke.cjs` | Stack real, migraciones, health, 404/401 y recuperación con nueva IP |
| Probar cookies/CSRF | `node frontend/tests/csrf-smoke.cjs` | Navegador y backend reales; receptor QA separado para observar transporte |

Las tres pruebas de contenedor requieren Chrome además de Node/Docker y se ejecutan desde la raíz. Crean proyectos exclusivos, puertos libres y perfiles temporales; retiran sus contenedores/redes/perfiles al terminar. Sus imágenes quedan locales. Los scripts muestran resultados sin tokens o credenciales. Se pueden repetir sin el proyecto interactivo; no usan sus datos.

El smoke de T1 se ejecuta sobre la portada y exige enlaces internos de esa página. No acredita recorridos de futuras pantallas ni debe modificarse para aceptar enlaces rotos. Cada pantalla tendrá sus pruebas de comportamiento propias.

## 3. Preparar la primera pantalla de un integrante

Antes de programar una pantalla:

1. Confirmar tarea y spec pequeña, responsable y revisor; citar RN y el contrato real del endpoint (método, ruta, entrada, éxito y errores). Consultar el estado y ramas del autor para no duplicar trabajo. No crear una spec por conversación ni inferir permisos por el nombre de la persona.
2. Indicar si será pública o requerirá sesión/rol/cooperativa. La autorización permanece en el backend; ocultar un enlace no protege una operación. Confirmar que el módulo está conectado al arranque real: health exitoso no acredita otros endpoints.
3. Consultar [DESIGN.md](DESIGN.md), identidad transViaje y [catálogo orientativo](../docs/design/pantallas.md). Elegir qué adoptar/adaptar/descartar; el PDF no obliga a reproducir campos o funciones. No recalcular descuentos, vencimientos, precios o disponibilidad en la vista.
4. Separar la tarea de su implementación: el cliente HTTP común es T3 y todavía no existe. Para conectar operaciones, acordar ese cliente y su contrato antes; no escribir un fetch/CSRF distinto por integrante. Login y renovación ligada a sesión autenticada no quedan resueltos por estas pruebas de T2.

Cuando la pantalla esté autorizada:

- Definir en su spec un archivo de página, por ejemplo `frontend/pages/<pantalla>.html`, y un módulo ES propio si lo necesita. Son ejemplos de rutas futuras, no directorios implementados en esta entrega.
- Reutilizar recursos locales con rutas desde raíz, como `/src/styles/app.css` y `/assets/…`, para que una página dentro de pages no busque assets en la carpeta equivocada. Mantener lang=es, viewport, título, un h1, main, enlace de salto, etiquetas y foco visible. La navegación debe llevar únicamente a destinos reales.
- Especificar estados de carga, vacío, error, éxito y recuperación según el contrato. No ofrecer acciones de fases futuras como disponibles ni convertir un error en éxito. Los permisos y el tenant los verifica el servidor.
- Coordinar con Pablo cualquier modificación de navegación, tokens, configuración Nginx/Compose o futuro cliente HTTP. Evitar que varias personas editen los archivos comunes en paralelo sin acuerdo.
- **Actualizar el empaquetado dentro de la tarea de la pantalla:** el Dockerfile y .dockerignore actuales incluyen index.html, app.css, assets y configuraciones concretas. Una nueva página o módulo ES no se copiará automáticamente. Añadir solo las rutas necesarias a ambas listas, conservar exclusión de documentación/tests/configuración sensible y comprobar el archivo servido desde la imagen real. No ampliar la copia a todo el repositorio para evitar ese paso.
- Crear pruebas de la pantalla y sus errores usando datos ficticios controlados; conservar las pruebas anteriores. Verificar teclado, foco, lectura, contraste, 360/1280 px y zoom nativo del 200 %. No sustituir la autorización del backend por una prueba visual.

## 4. Diagnosticar un problema local

| Síntoma | Primera comprobación y acción |
|---|---|
| Puerto ocupado | Elegir otro FRONTEND_DEV_PORT antes del arranque; no detener servicios ajenos |
| up indica proyecto existente | Usar status; si corresponde reiniciar los datos efímeros, down y luego up |
| Vista previa Python funciona pero API no | Usar el entorno dev.cjs; el servidor Python no conecta backend |
| API devuelve API_NOT_CONNECTED | Es el contenedor estático de T2.1; usar el modo conectado del lanzador |
| health falla o API devuelve 502/503/504 | Revisar status y arranque/migración; la portada puede seguir disponible. No diagnosticarlo como CSRF ni reintentar mutaciones automáticamente |
| 403 CSRF_TOKEN_INVALID | Revisar cookies/token de mismo origen y renovación de su vínculo; no desactivar CSRF. La política de recuperación común corresponde a T3 |
| Una página nueva responde 404 en Docker | Confirmar ruta real y listas Dockerfile/.dockerignore; no añadir fallback global a index.html |

Al pedir ayuda, compartir comando, versiones, status HTTP y resultado esperado/observado, sin .env, valores de cookies, tokens o credenciales. La configuración temporal usada por las pruebas es independiente de los datos del equipo.

## 5. Qué falta antes de pantallas autenticadas

T3: cliente común, respuestas vacías, normalización de errores, CSRF y recuperación de sesión. Una tarea específica debe definir confianza de proxy/IP antes de validar login completo o rate limiting individual; el backend sigue viendo la IP de Nginx. T4 comprobará la integración de la base completa. TLS, otros navegadores y Windows no se certifican con el entorno HTTP actual.

El resultado de T2 puede revisarse como un incremento propio, conservando estos límites. No implica aprobación humana, integración o cierre de FRONT-01.
