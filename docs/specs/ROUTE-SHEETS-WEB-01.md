# ROUTE-SHEETS-WEB-01 — Consulta y alta de borradores de hojas de ruta

- Responsable: David, por solicitud directa del 3 de noviembre de 2026.
- Rama existente: `feature/ROUTE-SHEETS-WEB-01-programacion-manual`, limpia sobre `9920792` (PR #68 integrada). Revisión humana pendiente; Leslie es revisora propuesta, sin aceptación inferida.
- David solicita dividir en dos secciones e implementar la primera. Esta autorización incluye definir la spec y la consulta conectada; no commits, push ni implementación de sección 2.
- Fuentes: [reglas](../business-rules.md), [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [defectos académicos](../errores-inducidos.md), [equipo](../equipo-y-acuerdos.md), [flujo](../flujo-codex.md), [estado](../estado-proyecto.md), [programación](ROUTE-SHEETS-06.md), [renovación](ROUTE-SHEETS-08.md) y [diseño](../../frontend/DESIGN.md).

## 1. Alcance y secciones

Esta pantalla es la entrada a la programación manual: consultar hojas y crear su cabecera DRAFT. No es el editor completo de programación ni un calendario de viajes vendibles. Esos incrementos requieren specs posteriores.

| Sección | Resultado verificable | Estado |
|---|---|---|
| 1 | Página conectada de consulta, grupos reales, filtros, autorización, estados vacíos/errores, pruebas y empaquetado. | Implementada y verificada localmente; revisión humana e integración pendientes. |
| 2 | Alta explícita de borrador con grupo y fecha, notas opcionales, CSRF, prevención de doble envío y confirmación de respuesta/resultado incierto. Actualiza el listado solo tras resultado verificable. | Planificada, no implementada ni autorizada todavía. |

Sección 2 usa el POST existente con busGroupId/routeDate/notes, sin tenant elegido por el navegador. Crear la cabecera no programa, publica ni genera viajes. Sus detalles y pruebas se concretarán antes de implementarla.

## 2. Contratos de sección 1

Página `/pages/hojas-ruta.html`. Reutiliza createApiClient, cookies de sesión y proxy existentes. Solo GET: `/api/v1/auth/me`, `/api/v1/bus-groups` y `/api/v1/route-sheets`. La autorización definitiva y el filtro por cooperativa permanecen en backend (RN-01/RN-02/RN-30).

Sesión verificada de COOPERATIVE_ADMIN con id/cooperative_id UUID. Antes y después de cada consulta se revalida la identidad. Cambio de actor/cooperativa, 401 o 403 limpia resultados; no mezcla datos entre sesiones. Acceso denegado distingue inicio de sesión de rol insuficiente. No usa almacenamiento persistente de datos privados.

Grupos: respuesta `{ busGroups: [{ id, name, ... }] }`, IDs únicos y nombres no vacíos. El endpoint autentica/filtra tenant; su DTO no incluye cooperative_id. Hojas: `{ routeSheets: [{ id, cooperativeId, busGroupId, routeDate, status, ... }] }`; se validan IDs únicos, tenant propio, grupo conocido, fecha real YYYY-MM-DD y estado DRAFT/PUBLISHED. Una respuesta inválida o ajena es error, nunca lista vacía. Se valida también que cada fila respete los filtros solicitados.

Filtros opcionales: busGroupId del catálogo actual, fromDate/toDate como fechas civiles válidas, rango ordenado y status DRAFT/PUBLISHED. Sin fechas por defecto ni horizonte inventado. No envía cooperativeId, actor, filtros desconocidos ni body. El API actual devuelve lista completa sin paginación: no simular páginas ni truncar resultados; paginación futura requerirá contrato backend propio.

Una carga por vez. Controles deshabilitados mientras carga, sin reintentos automáticos. Fallo de red/servidor limpia la lista anterior y permite volver a consultar. Estados diferenciados: comprobación/carga, lista, sin hojas, sin grupos, filtros inválidos, error, sesión vencida, rol insuficiente y sesión cambiada. Con cero grupos aún se consulta y valida la lista; una hoja que refiere un grupo ausente es error verificable.

La tabla muestra fecha civil sin conversión UTC, nombre del grupo, estado en español e identificador de hoja. Borrador/publicada no implican inventario ni venta habilitada. No muestra cycleLengthWeeks del DTO legado ni calcula duración desde conteos. No hay botones de crear/editar/publicar/renovar sin implementar.

## 3. Diseño, usabilidad y arquitectura

Se adopta DESIGN.md: marca/recursos locales, blanco/negro/violeta, tokens existentes, tarjetas y foco visible. Se adapta a una pantalla operativa con filtros y tabla desplazable en móvil; sin modificar estilos comunes ni navegación global. Acceso directo por URL y enlace a inicio/login reales. No se incorpora contenido de mockups como instrucciones ni se añaden dependencias.

Etiquetas explícitas, fieldset/legend, mensaje aria-live, estado de carga aria-busy, aviso de validación enfocable y controles por teclado. Estado expresado por texto además del color. Fechas civiles y estados comprensibles; nunca se representa un error como ausencia de hojas. Sin JavaScript, filtros deshabilitados y explicación visible.

Controlador con cliente/vista inyectados; contratos y filtros puros separados del DOM; vista crea nodos/textContent (sin HTML de respuestas). No modifica backend, reglas, migraciones, login o cliente compartido. Dockerfile/.dockerignore incluyen únicamente página, módulos y CSS nuevos. Scripts/config de lint y pruebas incorporan el directorio nuevo.

## 4. Aceptación y verificación

- Consulta datos propios reales mediante sesión autorizada; otro rol no solicita grupos/hojas.
- Filtros válidos se codifican sin tenant; fechas imposibles/invertidas y grupo inexistente no solicitan hojas.
- Respuesta inválida, error de red, 401/403 o cambio de sesión limpian cualquier lista anterior.
- Diferencia vacío, ausencia de grupos, carga y error; evita cargas simultáneas.
- Nombres/notas potencialmente hostiles se muestran como texto; no ejecuta HTML.
- Escritorio/móvil, teclado, foco, etiquetas, reflujo y recursos locales comprobados con navegador. Los dobles QA se identifican como pruebas; no se acreditan lecturas PostgreSQL reales por usar fixtures HTTP.
- Frontend lint/pruebas, formato propio, imagen Nginx y respuesta del recurso empaquetado. Backend lint/format:check/npm test con PostgreSQL aislado según testing-database.md; reportar resultados reales y límites. No introducir ni corregir defectos académicos sin autorización específica.

## 5. Evidencia de sección 1

Implementada sobre 9920792, sin cambios de backend, migraciones, dependencias ni pruebas previas. Página /pages/hojas-ruta.html, contratos/filtros puros, controlador inyectable y vista segura separados en src/route-sheets. Scripts de lint/pruebas y empaquetado Nginx incorporan únicamente los recursos nuevos. Se reutiliza el transporte compartido con cache no-store; no se almacena información privada en localStorage ni se envía tenant.

Frontend: **250/250 pruebas finales con Node 24.21.0**, incluidas 23 nuevas. Lint frontend aprobado. Se verifican fechas imposibles, rango invertido, filtro ajeno, IDs duplicados, respuesta inválida/ajena, roles, 401/403/500, errores de red, cambios de actor/cooperativa durante la lectura de grupos y después de leer hojas, limpieza de resultados y prevención de cargas simultáneas. La validación inicial de 249 casos aprobó; al cerrar el camino de grupo ausente con revalidación de sesión se añadió un caso y se repitió toda la suite.

Backend, sin cambios: npm run lint aprobado; npm test con Node 24.21.0 y PostgreSQL 16.13 aislado aprobó **1815/1815 unitarias (94 suites) y 577/577 integraciones (45 suites)**. En esta ejecución aprobaron fotos de Fleet y administradores; no se les cambia código ni timeout y no se declara corregido su historial de fallos. Format:check global conserva 39 archivos previos sin modificar. Formato de módulos, pruebas nuevas, página, CSS y package.json aprobado; configuración ESLint compartida conserva el estilo previo.

Prueba reproducible: npm run test:route-sheets desde frontend, Docker disponible y BROWSER_BIN apuntando a Chrome cuando no esté en PATH. Usa createRuntime existente con --env-file vacío, un proyecto Docker exclusivo y credenciales generadas solo para QA. Arranca PostgreSQL, migraciones, backend Node 24 y Nginx reales; crea usuarios/grupos ficticios y cabeceras por el POST real solo como preparación de prueba. La pantalla de producción usa exclusivamente GET.

Chrome real aprobó los recorridos de sesión ausente, administrador propio con dos hojas, cooperativa ajena, grupo vacío, rol CUSTOMER, filtro de fecha/estado, rango inválido con foco en aviso, limpieza de filtros, cambio de sesión con datos descartados, fallo de conexión y recuperación. El nombre de grupo hostil se muestra como texto, sin crear imágenes ni ejecutar código. Capturas inspeccionadas a 1280 y 360 px, sin desbordamiento de página; tabla desplazable y fechas/estados sin partir. Se mejoró la presentación móvil después de la primera inspección y se repitió QA. La última ejecución incluye navegación Tab entre controles y foco del error. No acredita accesibilidad exhaustiva ni una pantalla de edición.

Una ejecución auxiliar de frontend en Docker falló porque su copia temporal omitía los fixtures/backend que importa una prueba previa de Reservas: 221 aprobadas y una suite no cargada. Se repitió con la estructura completa: 250/250 aprobadas. No se alteró esa prueba ni se ocultó el intento. Las dependencias del lock solo se instalaron en contenedores efímeros; antes de reutilizar binarios de Sharp se comprobó lock idéntico a la imagen local. No se leyó .env.

Diff completo revisado y comprobado sin conflictos ni espacios finales. Proyectos de navegador y PostgreSQL exclusivos retirados al finalizar. Capturas de QA en el directorio temporal route-sheets-web-01-qa, fuera del repositorio; el texto hostil de las capturas es un fixture deliberado de prueba, no un dato real. Asistencia de Codex en planificación, implementación y pruebas. No hay commits, push, aprobación humana ni integración de esta tarea acreditados.

Sección 2 continúa pendiente: crear un borrador explícito desde esta pantalla, sin introducir programación, publicación ni renovación en ese incremento. Mensaje sugerido para sección 1: feat(hojas-ruta): agrega la consulta web de hojas de ruta.
