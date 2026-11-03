# FREQUENCIES-WEB-01 — Pantalla de creación de frecuencias

- **Referencia:** D-06, primera tarea de pantallas operativas; sin ticket externo.
- **Responsable:** David, por actividad seleccionada por el solicitante.
- **Estado:** Sección 0 guardada por el humano en 954e7fc; sección 1 implementada localmente, pendiente de revisión humana. Sección 2 pendiente de autorización.
- **Fecha:** 2 de noviembre de 2026, America/Guayaquil.
- **Rama/base comprobada:** feature/FREQUENCIES-WEB-01-creacion-frecuencias, 1daa3c4, árbol inicialmente limpio. Ese commit integra D-04/PR #49. Sin fetch ni certificación de cambios remotos posteriores.
- **Revisión propuesta:** Leslie para el contrato funcional; Pablo para cambios compartidos de frontend. No se atribuye aceptación ni revisión humana a estas personas.
- **Autorización actual:** David solicitó sección 1 y confirmó Q1 el 2 de noviembre: conservar valores por tramo con aclaración del precio comercial por hoja. No autoriza sección 2, commits, publicación ni otras pantallas.

## 1. Objetivo y fuentes

Permitir al administrador de cooperativa crear una frecuencia directa o con paradas autorizadas desde una pantalla en español, usando sesión y cliente HTTP existentes. La creación no publica una hoja ni pone puestos a la venta.

Fuentes: [reglas de negocio](../business-rules.md), RN-02 y RN-20–23; [acuerdos vigentes](../acuerdos-primera-entrega.md); [FREQ-01](FREQ-01.md), [FREQ-02](FREQ-02.md), [ROUTE-SHEETS-05](ROUTE-SHEETS-05.md), [ROUTE-SHEETS-06](ROUTE-SHEETS-06.md); [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [flujo](../flujo-codex.md), [equipo/acuerdos](../equipo-y-acuerdos.md) y [protocolo académico](../errores-inducidos.md).

Frontend: aplicar [DESIGN.md](../../frontend/DESIGN.md), [guía de integración](../../frontend/GUIA-INTEGRACION.md) y contratos de [FRONT-01](FRONT-01.md)/[AUTH-WEB-01](AUTH-WEB-01.md). Los estados históricos de esas guías no sustituyen la inspección del código actual.

## 2. Alcance de esta tarea

Incluye, tras autorización funcional: página de alta, paradas ordenadas, validaciones de ayuda, comprobación de sesión/rol, envío por cliente compartido, recuperación de errores y confirmación verificable de creación. Origen/destino/hora son editables antes del alta y se presentan como inmutables una vez creada; no se implementa edición posterior. ANT exige número de resolución, no carga de documento ni integración con el regulador.

Fuera: listado/detalle general y cambio de estado de frecuencias (segunda tarea de D-06); pantalla de hoja manual (tercera tarea); renovación/excepciones D-05; búsqueda pública; reservas, descuentos, boletos, Wallet y Chofer/Controlador. No modificar reglas de backend para acomodar el formulario ni corregir de paso el cambio de estado.

## 3. Evidencia y dependencias comprobadas

| Elemento | Situación en 1daa3c4 |
|---|---|
| Frecuencias | POST /api/v1/frequencies conectado en app/server; authenticate, COOPERATIVE_ADMIN y CSRF. Crear toma cooperative_id de la identidad verificada. |
| Validación | frequency.js exige resolución, lugares distintos, hora válida, paradas sin duplicados y exactamente N+1 precios consecutivos. |
| Frontend | Existen login.html, auth/login-page.js y api/api-client.js; no existe pantalla de frecuencias. El controlador de login no es un guard de rol reutilizable de todas las pantallas. |
| Sesión | GET /api/v1/auth/me responde { user }; se debe comprobar rol y cooperativa, no solo email. El backend sigue siendo autoridad de acceso. |
| Transporte | createApiClient().request utiliza mismo origen, cookies y caché CSRF; no crear fetch, almacén de tokens o login alternativo. |
| Empaquetado | Dockerfile/.dockerignore incluyen páginas y directorios concretos; la página nueva no se empaquetará sin incorporarlos expresamente. |
| Calidad | Scripts frontend actuales enumeran src/api, src/fleet, src/auth y sus pruebas; será necesario incorporar el directorio nuevo al lint/test sin retirar comprobaciones existentes. |

La evidencia anterior procede de lectura, no de nuevas pruebas de ejecución en esta sección. La dependencia de Fleet/listado de buses y lectura del tarifario afecta a la futura hoja manual, no bloquea esta pantalla.

## 4. Contrato HTTP existente

`POST /api/v1/frequencies`, JSON mediante cliente compartido; usuario COOPERATIVE_ADMIN con cooperativa verificada y CSRF. No enviar cooperative_id ni permitir elegir cooperativa.

| Campo | Tipo real / comportamiento |
|---|---|
| origin, destination | Texto no vacío; trim; distintos ignorando mayúsculas/espacios externos. |
| departure_time | Hora 24 h; UI HH:mm; backend admite una o dos cifras de hora y normaliza HH:mm. 00:00 es válido, no una fecha ni 24:00. |
| ant_resolution_number | Texto obligatorio no vacío; sin patrón ni límite de longitud de negocio nuevos. |
| status | ACTIVE o INACTIVE; omitido/null produce ACTIVE. Propuesta de UI: selector «Activa/Inactiva», Activa inicialmente. No es acción de cambio posterior. |
| stops | Array ordenado de nombres; [] para directa. Sin vacíos, repetidos ni origen/destino, comparando trim/minúsculas. |
| segment_prices | Array de números USD, no centavos ni cadenas; exactamente stops.length+1, >0, máximo 99.999.999,99 y hasta dos decimales. Su presentación depende de Q1. |

Ejemplo ilustrativo del contrato actual, no creación realizada ni tarifa comercial:

```json
{
  "origin": "Ambato",
  "destination": "Quito",
  "departure_time": "07:00",
  "ant_resolution_number": "ANT-EJEMPLO-001",
  "status": "ACTIVE",
  "stops": ["Latacunga"],
  "segment_prices": [2, 3]
}
```

Éxito: HTTP 201, `{ frequency }`; contiene id, cooperative_id, origin, destination, departure_time, ant_resolution_number, status, stops, segment_prices y timestamps. Validar la forma mínima esperada antes de mostrar éxito; pintar datos con textContent, sin interpolar HTML de la API.

Errores conocidos: 400 VALIDATION_ERROR, FREQUENCY_REQUIRES_ANT_RESOLUTION o FREQUENCY_SEGMENT_PRICES_MISMATCH; 409 FREQUENCY_ALREADY_EXISTS; 403 FORBIDDEN; también errores de autenticación/CSRF y transporte del cliente compartido. No mostrar trazas ni asumir que todos los errores vienen del router de frecuencias.

## 5. Diferencias de contrato y acuerdo confirmado

### Q1 — Precios consecutivos históricos frente a tarifa comercial

**Participantes propuestos:** David, Leslie; responsable comercial cuando corresponda. **Estado:** confirmado por David el 2 de noviembre de 2026 mediante respuesta «Sí, conservarlos con esa aclaración». La confirmación cubre la recomendación siguiente; no se atribuye aceptación individual a Leslie.

El POST vigente obliga a proporcionar precios consecutivos. La regla comercial actual configura todos los pares en la hoja y congela al publicar. No eliminar segment_prices del envío, rellenarlo con ceros/valores inventados ni sumar esos precios para vender un viaje.

**Decisión confirmada para esta pantalla:** conservar un bloque explícito «Valores por tramo del registro de frecuencia», con ayuda que indique que no fija el precio de venta y que el tarifario comercial se configura en la hoja. Capturar valores reales del usuario y mantener el contrato vigente, sin promoverlos como política comercial. **Alternativa no seleccionada:** adaptar primero el alta de backend mediante una tarea separada que retire esa exigencia; requeriría su spec, compatibilidad y pruebas.

### Horas de las paradas: límite comprobado

El alta actual acepta stops como nombres, sin horas. La programación de ROUTE-SHEETS-06 almacena llegada/salida fechadas por punto, incluidos cruces de medianoche. Esta pantalla no solicitará horas que el POST descartaría ni simulará guardarlas. Si se necesitan horarios normativos de cada parada en la propia frecuencia, cerrar un contrato backend en tarea separada; esta spec no declara resuelto ese alcance mediante la programación.

## 6. Flujo y estados previstos

1. Abrir `/pages/crear-frecuencia.html`; comprobar `/api/v1/auth/me` antes de habilitar envío. Sin sesión: explicar y enlazar login existente; rol/cooperativa no válidos: acceso no permitido. Fallo de comprobación: mostrar reintento, no tratarlo como sesión válida.
2. Completar origen, destino, hora, ANT, estado y paradas opcionales; mostrar recorrido y tramos resultantes. Agregar/quitar/mover paradas mediante botones con nombres accesibles, sin exigir arrastre. Al cambiar extremos u orden, invalidar precios de enlaces afectados: no reasignar silenciosamente un precio a otro tramo.
3. Mostrar aviso de inmutabilidad antes del alta. Validar formato para ayudar al usuario; el backend verifica negocio, tenant y duplicados.
4. Sección 1: formulario local sin POST ni mensaje de creación exitosa; cualquier acción provisional debe indicar que la conexión aún no está disponible. Sección 2: enviar una sola solicitud mientras esté ocupada, sin reintento automático de POST.
5. HTTP 201 válido: mostrar ID y resumen real en modo lectura. Mantener el formulario fuera de edición; ofrecer «Crear otra frecuencia» como acción explícita. No enlazar listado inexistente.
6. Errores corregibles: conservar entradas y señalar campos cuando el código permita identificarlo; no inventar detalle por campo si el servidor solo da VALIDATION_ERROR. Sesión vencida: detener envíos y ofrecer login; no guardar datos en localStorage para restaurarlos automáticamente.
7. Red caída, respuesta inválida o error técnico tras POST: informar que no se pudo confirmar el resultado y que podría haberse creado. No anunciar fallo definitivo ni reenviar automáticamente: el alta actual no tiene clave de idempotencia y un reintento puede devolver duplicado. La futura pantalla de listado permitirá conciliación; aquí se explica esa limitación.

## 7. Diseño, estructura y coordinación

Adoptar Bootstrap local, identidad transViaje blanco/negro/violeta, tokens de app.css, tipografía y foco de DESIGN.md. Adaptar referencia M-04 del catálogo a un formulario de frecuencia; descartar funciones ajenas, métricas y botones sin destino. No copiar interfaces de otras marcas ni introducir dependencias. Sin defecto académico en esta tarea; los candidatos de ACADEMICA-01 no autorizan desviaciones aquí.

Archivos previstos: `frontend/pages/crear-frecuencia.html`, módulos ES en `frontend/src/frequencies/` (formulario/controlador, vista y entrada de página según responsabilidades), pruebas en `frontend/tests/frequencies/` y recorrido navegador/API propio. Separar gestión de campos/renderizado de coordinación de sesión/envío; inyectar cliente/vista para pruebas unitarias. No importar backend en navegador ni refactorizar auth/fleet para añadir abstracciones generales.

Incorporar únicamente los archivos nuevos necesarios a Dockerfile/.dockerignore y scripts lint/test en su sección; no ampliar copias a todo el repositorio. Coordinar con Pablo modificaciones compartidas de navegación/estilos/configuración; no añadir un enlace global sin acordar ubicación. La página puede probarse por ruta directa. No alterar el flujo de login ni sus pruebas para aparentar integración.

## 8. Criterios y verificación futura

- [ ] Alta directa y con paradas guarda datos reales, orden y valores explícitos de Q1; éxito solo tras 201 válido.
- [ ] ANT vacío, lugares repetidos, hora inválida y montos inválidos explican corrección; 00:00 permitido.
- [ ] No campo de tenant, edición posterior, archivo ANT, tarifa comercial calculada ni cambio de estado de una frecuencia existente.
- [ ] Sin sesión/rol correcto no se habilita alta; API real rechaza acceso directo no autorizado y conserva aislamiento entre dos cooperativas.
- [ ] Doble clic produce una solicitud; fallo ambiguo no provoca reintento automático ni falso éxito.
- [ ] Errores preservan datos no sensibles en memoria, respetan foco y anuncian estado; no exponen trazas.
- [ ] Teclado: Tab/Shift+Tab/Enter completan el flujo, botones de paradas operables, foco visible y situado tras agregar/quitar/mover o al primer error.
- [ ] A 360 y 1280 px y zoom 200 %, sin perder campos/acciones; contraste de texto normal >=4,5:1 y estados no comunicados solo por color.
- [ ] Página y módulos incluidos en imagen, sin 404; ruta directa, login y API real bajo el mismo origen verificados.

Pruebas de controlador/vista con dobles solo en unitarias; recorrido navegador contra backend/PostgreSQL aislado para alta, duplicado, errores y sesión. Seguir [base de pruebas](../testing-database.md), sin leer .env ni usar datos reales. Ejecutar pruebas/lint frontend incluyendo el directorio nuevo, formato de cambios y comprobaciones backend requeridas por AGENTS; si cambia composición, arranque real. Registrar comandos, conteos, capturas de móvil/escritorio y límites reales. No cambiar pruebas anteriores ni migraciones para superar verificaciones.

Las cifras de D-04 y el timeout previo de fotos pertenecen a aquella ejecución, no son resultados de esta pantalla. Node 24 y verificación de empaquetado se comprobarán al implementar; no se certifican por esta sección documental.

## 9. Secciones y commits

| Sección | Resultado | Commit sugerido |
|---|---|---|
| 0 | Esta spec, evidencia y seguimiento; sin producto | docs(frecuencias): define la pantalla de creación |
| 1 | Tras cerrar Q1 y autorización: formulario accesible, paradas, validación de ayuda y pruebas locales; sin POST | feat(frecuencias): agrega el formulario de creación |
| 2 | Tras autorización: sesión, cliente compartido, envío real, errores, empaquetado y recorrido API/navegador | feat(frecuencias): conecta el alta con la API |

Un commit por sección incluye evidencia pertinente; el asistente no los ejecuta sin petición expresa. Listado/estado y hoja manual tendrán specs y ramas separadas. No requieren esperar a renovación para preparar el alta.

## 10. Evidencia de sección 0

Inspeccionados contrato de dominio, caso de uso, repositorio/router de frecuencias, montaje, cliente HTTP, sesión/login, guía visual, reglas, specs antecedentes y empaquetado/scripts existentes. No había spec ni archivos de pantalla FREQUENCIES-WEB-01 en el árbol examinado. Estado inicial limpio en 1daa3c4; sin revisión de ramas privadas o PR remotas posteriores.

Solo se crean esta spec y el seguimiento relacionado. Q1 queda expresamente pendiente; no se solicitan credenciales ni se leen .env. No se implementan formulario, endpoints, algoritmo, dependencias, defectos, tests ejecutables ni cambios de empaquetado. Diff revisado y git diff --check aprobado; 78 enlaces locales entre spec/seguimiento comprobados sin destinos inexistentes (sin certificar anclas ni fuentes externas). Lint/Jest/navegador no corresponden a cambios exclusivamente Markdown y no se declaran ejecutados. Revisión humana, implementación e integración pendientes.

## 11. Sección 1 — formulario local

Base 954e7fc, rama feature/FREQUENCIES-WEB-01-creacion-frecuencias inicialmente limpia. David solicitó sección 1 y confirmó Q1 con su respuesta expresa registrada en sección 5. La evidencia de sección 0 conserva su estado histórico; Q1 ya no está pendiente. Sin fetch ni nueva revisión humana inferida.

### Comportamiento implementado

Página `/pages/crear-frecuencia.html`, módulos de estado/validación, vista y entrada en `frontend/src/frequencies/`, y CSS local `frequency-form.css` que reutiliza tokens de app.css. Adopta DESIGN.md sin cambios a estilos globales, navegación, login o cliente HTTP compartidos. El formulario muestra origen/destino/hora, ANT, estado inicial y paradas opcionales; advierte la inmutabilidad posterior y distingue valores consecutivos del registro de frecuencia frente al precio comercial por hoja.

Los controles permiten añadir, subir, bajar y quitar paradas con botones nativos; conservan identidad de fila, anuncian el resultado y colocan foco en la parada movida, vecina o botón de añadir. Los precios se asocian a los extremos concretos del enlace: cambiar un nombre, extremos u orden borra valores afectados; no migra silenciosamente un valor a otro tramo ni restaura un valor descartado al volver al orden anterior. Enlaces no afectados conservan valores. No se calculan tarifas de boletos ni suma de tramos.

Las ayudas locales admiten medianoche, verifican campos obligatorios, resolución no vacía, lugares distintos sin repetir paradas y un monto USD positivo de hasta dos decimales por enlace. Admiten punto o coma decimal sin separador de miles, convirtiendo a números solo al revisar; no se envían. No añaden un patrón ANT ni límites de longitud nuevos. El backend sigue siendo autoridad funcional para sección 2.

«Revisar datos» impide navegación/envío nativo, presenta errores con aria-invalid/descripciones y enfoca el primer campo afectado; si es válido confirma únicamente revisión local, nunca alta. No se comprueba sesión ni se importa cliente HTTP en esta sección. No hay fetch, POST, datos reales persistidos, simulación de éxito, almacenamiento local o selector de cooperativa. Sin JavaScript, el fieldset permanece deshabilitado y se explica la limitación.

### Calidad y pruebas

Estado/validación separados del DOM, cambios de estado sin mutar borradores anteriores y renderizado con textContent/elementos nativos. Ningún HTML de lugares o mensajes se interpreta. Tests/lint frontend incorporan únicamente los directorios nuevos; pruebas anteriores conservadas. Script `npm run test:frequencies` ejecuta navegador real con servidor estático temporal, sin mock de API. En Windows se configura BROWSER_BIN con la ruta instalada de Chrome; QA_OUTPUT_DIR controla destino de capturas. No incorpora paquetes nuevos.

Frontend: **128 pruebas unitarias aprobadas, incluidas 13 nuevas**, y lint aprobado. Navegador Chrome headless: **7 comprobaciones finales aprobadas** de campos/etiquetas, error ANT y foco, directa a las 00:00, paradas y tramos, texto no interpretado, teclado/reflujo móvil y contraste; cero solicitudes API y sin recursos externos. La primera ejecución detectó que la secuencia CDP Enter del nuevo script carecía del carácter correspondiente; se completó la secuencia y se mantuvieron sus comprobaciones. Se añadió foco violeta explícito para controles de esta pantalla, evitando que el estilo de Bootstrap oculte el foco previsto en DESIGN.md.

Capturas de errores/escritorio, directa, móvil de 360 px y ampliación de texto revisadas; guardadas en el directorio local de visualizaciones, carpeta frequencies-web-01, no en el repositorio. Se comprueba reflujo a 360/1280 px y se aproxima ampliación con viewport efectivo 640 px y texto al 200 %; no se certifica zoom nativo del navegador, lector de pantalla ni otros navegadores. Contrastado texto normal/error/ayudas/enlaces/botón con sus fondos mediante colores calculados; no se afirma conformidad global de accesibilidad.

La lectura/escritura real, autorización por rol, CSRF, confirmación de alta, rechazo de duplicados en API y empaquetado Docker siguen pendientes de sección 2. Dockerfile/.dockerignore permanecen intactos: esta página todavía no está incluida en la imagen. No se declaran aprobados los criterios que dependen de esos recorridos.

Backend: lint aprobado; `npm test` ejecutado con PostgreSQL aislado: **1297 unitarias y 371 integraciones aprobadas, una integración fallida** por timeout de 20 segundos en `fleet/bus-photo-storage.test.js`, caso «prepara y promueve todos los bytes sin conservar nombres ni rutas del cliente», ya observado en D-04. No se cambia el caso, su tiempo límite ni Fleet. La suite global es fallida; no es un defecto académico autorizado. `format:check` global mantiene 41 archivos previos pendientes; formato de todos los archivos nuevos/cambiados aprobado con Prettier y single-quote para JavaScript frontend. Node local 22.19.0; validar Node 24 sigue pendiente.

Diff completo revisado y git diff --check aprobado; enlaces locales de spec/seguimiento comprobados. PostgreSQL temporal busesuta-freqweb-s1 iniciado con --env-file NUL y credenciales ficticias versionadas, retirado al terminar. Sin .env leído. No se modifica backend, migraciones, pruebas previas ni defectos académicos. Sin commit/PR/merge ejecutados ni revisión humana atribuida.

Commit sugerido: `feat(frecuencias): agrega el formulario de creación`.
