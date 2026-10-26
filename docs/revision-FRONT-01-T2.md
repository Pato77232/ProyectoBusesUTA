# Revisión propuesta de FRONT-01 T2

Estado: T2.4 documentado/verificado, guardado y publicación de rama autorizados por Pablo; PR, revisión humana e integración pendientes. T1 fue aprobada por Shirley e integrada en PR #16; esa aprobación no cubre automáticamente T2. Autor de referencia: Pablo; revisor de T2 pendiente de confirmar.

## Base y alcance

- Rama: `feature/FRONT-01-T2-proxy`.
- Commits de T2: 2815747 (plan), 19e8e0d (imagen), 4d37295 (entorno/proxy), cddbe34 (cookies/CSRF) y el commit documental de T2.4 que incluye este archivo.
- Base integrada de T1: eebfe75. Develop contrastado el 26 de octubre de 2026: c8bb5d3.
- Desde T1, develop añadió PAGOS-01 y archivos nuevos de dominio/aplicación/pruebas de pagos; no cambió server.js, app.js o Compose ni se solapó con los archivos de T2. Esta observación no acredita pruebas de la combinación: los resultados siguientes pertenecen a nuestra rama.
- No se ejecutó merge/rebase ni se incorporó el trabajo de pagos. La comparación de PR desde el ancestro común muestra únicamente T2, no repite T1. No se encontró una PR de T2 publicada en la consulta realizada.

T2 entrega empaquetado estático y entorno local de mismo origen con Nginx, backend/DB reales, migraciones ordenadas, aislamiento y pruebas del transporte/cookies. No implementa cliente HTTP de producción, login o pantallas de negocio.

## Matriz de criterios de FRONT-01

| Criterio general | Evidencia disponible | Estado/alcance |
|---|---|---|
| HTML/CSS y health real desde un origen | proxy-smoke y lanzador en 8081 | Comprobado en T2; la portada no muestra un indicador de conexión |
| Prefijo, errores, ausencia de fallback y cookies | Proxy real, 404/401 y csrf-smoke | Comprobado en T2; no acredita roles o una sesión autenticada |
| CSRF, login/logout y renovación tras cambio de sesión | CSRF anónimo y tokens inválidos/rotados | Parcial: login/logout completos y renovación ligada a sesión pendientes de T3/T4 |
| Cliente HTTP maneja 200/201/204, red, JSON inválido, 401/403/429/5xx | Respuestas reales del servidor observadas | Cliente aún no implementado; criterio general pendiente de T3/T4 |
| Carga/conexión/error y reintento con teclado en la vista | Portada accesible con navegación real | Estados de conexión de la base completa pendientes de T3/T4 |
| Teclado, lectura y adaptación | Chrome 360/1280 y CSS zoom 200 % | Comprobado en emulación; zoom nativo, ayudas técnicas y otros entornos pendientes |
| Versiones/procedencia de recursos | Dockerfile con digest y licencias conservadas | Comprobado; no sustituye revisión de vulnerabilidades o despliegue real |

Las casillas de pruebas específicas de T2 en frontend-t2-plan.md no equivalen a cerrar todos los criterios generales de FRONT-01. El cumplimiento de una ejecución automatizada tampoco es aceptación humana.

## Verificación consolidada de T2.4

Entorno: Linux, Node 24.21.0, Chrome 153.0.8010.36, Docker Compose 5.6.1. Ejecuciones aisladas, sin .env o datos reales. Pruebas de frontend secuenciales para evitar compartir procesos/contenedores; suite de backend en PostgreSQL aparte.

| Comando | Resultado final |
|---|---|
| node frontend/tests/container-smoke.cjs | Aprobado: imagen, MIME, archivos/exclusiones, errores y navegador |
| node frontend/tests/proxy-smoke.cjs | Aprobado: stack real, migraciones, health/404/401, caída y cambio de IP |
| node frontend/tests/csrf-smoke.cjs | Aprobado: cookies/CSRF con Chrome y backend reales; transporte con receptor QA separado |
| npm run lint (backend) | Aprobado |
| npm test (backend) | 346 aprobadas: 239 unitarias y 107 integración |
| npm run format:check (backend) | Fallido en los mismos 26 archivos preexistentes del backend; sin cambios en ellos |
| Prettier propio, sintaxis Node, enlaces y git diff --check de T2 | Aprobados |

Evidencia reproducible en scripts y secciones 19–23 de la spec. Logs locales de esta auditoría en `/tmp/busesuta-t24-static.log`, `busesuta-t24-proxy.log`, `busesuta-t24-csrf.log` y `busesuta-t24-backend.log`, sin valores de tokens/cookies. Los proyectos QA y el PostgreSQL aparte busesuta-front01-t24 fueron retirados; las imágenes permanecen en caché. Las capturas se regeneran por las pruebas, no se incluyen como recursos del producto. Añadirlas a la revisión si se necesita evidencia visual; no afirmar que están adjuntas a una PR inexistente.

## Reproducción por otro integrante

Seguir [frontend/GUIA-INTEGRACION.md](../frontend/GUIA-INTEGRACION.md): up/status/down, lectura del health y comprobaciones por modo. Ejecutar las tres pruebas con Docker/Chrome; para npm test usar la DB aislada de [testing-database.md](testing-database.md). No compartir configuración renderizada, perfiles o valores de cookies.

Registrar en la spec persona, fecha, sistema, comandos, resultado real, observaciones y alcance aceptado. Revisor y decisión no se completan por inferencia. Antes de integrar, comprobar el diff actualizado y ejecutar validación sobre la combinación real que se vaya a aceptar.

## Límites y pendientes que deben permanecer visibles

- El backend ve la IP del proxy; no se validó separación de rate limiting por cliente. Se necesita una tarea delimitada de confianza de proxy antes de login integrado o despliegue público.
- La comprobación de Secure/__Host usa flags emitidas por el backend QA en modo production, leídas por HTTP; no acredita TLS ni aceptación de cookies por navegador HTTPS.
- Casos CSRF positivos alcanzan validación de credenciales con datos inválidos, sin crear usuarios/sesiones. No representan registro o login completos.
- Un receptor efímero distinto del backend observa método/URI/query/cuerpo/cabeceras; su respuesta no acredita autenticación. Se retira al terminar.
- Sin prueba Windows, otros navegadores, zoom nativo al 200 %, ayudas técnicas o estudio con usuarios.
- El fallo global de formato preexistente debe reportarse como fallido, no como defecto académico inducido o control aprobado. Su resolución/decisión de revisión queda pendiente; esta tarea no modifica los archivos ajenos para ocultarlo.
- Un futuro archivo pages/módulo ES requiere cambios explícitos del empaquetado y su propia spec/prueba; la guía los explica, pero no incorpora pantallas vacías o un cliente ficticio.

## Contenido preparado para una PR de T2

Título propuesto: `feat(infra): sirve transViaje y conecta la API en el entorno local`.

Descripción sugerida:

> FRONT-01 T2 incorpora un contenedor Nginx sin root y un entorno local con frontend/API de mismo origen. El lanzador genera credenciales efímeras, aplica migraciones existentes y aísla PostgreSQL/backend, publicando únicamente el frontend en loopback.
>
> Se comprueban empaquetado, MIME/exclusiones/404, health real, caída y recuperación con cambio de IP, cookies/CSRF desde Chrome y tratamiento de cabeceras. El modo estático de T2.1 permanece como regresión independiente. La guía del equipo y la matriz de revisión documentan reproducción, límites y preparación de futuras pantallas.
>
> No incluye cliente HTTP, login, pantallas de negocio, ampliación de confianza de IP, TLS o cambios de producción/migraciones. Los mockups siguen siendo orientativos. T1 ya está integrada en PR #16 y no se repite en el diff.
>
> Validación local: las tres pruebas de frontend, lint, formato propio y 346 pruebas de backend aprobados. npm run format:check del backend falla en los mismos 26 archivos preexistentes, sin modificarlos. Navegador a 360/1280 px y CSS zoom 200 %: aprobado; zoom nativo, Windows y ayudas técnicas pendientes. Probar con node frontend/scripts/dev.cjs up/status/down y ejecutar las pruebas listadas. Documentos: docs/specs/FRONT-01.md, frontend/GUIA-INTEGRACION.md y docs/revision-FRONT-01-T2.md.
>
> Base remota contrastada: c8bb5d3; resultados de esta rama, sin validar aún la combinación con los nuevos archivos de pagos. Revisión humana y validación de la combinación antes de integrar pendientes. Implementación/documentación/pruebas asistidas por Codex bajo instrucciones de Pablo. Refs: docs/specs/FRONT-01.md.

Esto es material para redactar la PR; no crea PR, asigna revisor, publica la rama, integra cambios ni confirma aprobación. T2.4 documenta el incremento comprobable; FRONT-01 completa sigue en desarrollo por T3/T4.


Revisor recomendado: Shirley (`shirley6126`), por la coordinación de referencia de infraestructura/autenticación de Pablo y su revisión previa de T1. Es una recomendación; no se envía solicitud ni se presupone disponibilidad o aceptación. Pablo pidió entregar el contenido de la PR, no crearla automáticamente.
