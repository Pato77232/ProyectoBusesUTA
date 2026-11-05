# SEARCH-02: Próximas salidas sin escribir origen, destino y fecha

- **ID local:** SEARCH-02. Sin ticket externo.
- **Solicitante:** Edwin (pato77232), 11 de noviembre de 2026.
- **Revisión propuesta, sin aceptación inferida:** David (Route Sheets, dueño de los viajes comerciales) y quien mantiene SEARCH-01.
- **Estado:** Implementación autorizada por Edwin el 11 de noviembre de 2026 («Al oficinista debería aparecer como una tabla y ver los viajes de cada día, lo demás me parece perfecto para implementar»). Revisión de David pendiente.
- **Base comprobada:** `feature/FRONT-02-cierre-flujo-web`, desde `origin/develop` `162c80b`.
- **Relación:** amplía [SEARCH-01](SEARCH-01.md) sin cambiar su contrato. Afecta las pantallas «Buscar viajes» y «Vender en boletería» ([BOOK-CAJA-02](BOOK-CAJA-02.md)).

## 1. Problema

Hoy `GET /api/v1/trips` exige origen, destino y fecha; sin los tres responde 400. El cliente y el oficinista no ven nada hasta adivinar una combinación exacta, por ejemplo «Ambato» y «Quito» escritos igual que en la frecuencia. Si no saben qué rutas existen, la pantalla aparece vacía.

## 2. Objetivo

Al abrir «Buscar viajes», mostrar de inmediato las **próximas salidas a la venta**. En «Vender en boletería», mostrar las próximas salidas **de la cooperativa del oficinista**. El formulario sigue disponible para afinar por tramo y fecha.

## 3. Reglas que se mantienen

- Solo viajes de hojas **publicadas**, con salida futura y que la consulta comercial confirme vendibles: ventana de dos ciclos y frecuencia activa (SEARCH-01, ROUTE-SHEETS-04).
- Es una lectura pública: sin datos de pasajeros ni ocupación. La disponibilidad de asientos se comprueba al elegir el viaje (RN-40).
- La boletería sigue exigiendo la cooperativa de la sesión al cotizar, reservar y cobrar; el filtro de esta lista es solo de presentación.

## 4. Propuesta

### 4.1 API nueva, sin tocar la búsqueda existente

`GET /api/v1/trips/upcoming`, pública y de solo lectura, con `Cache-Control: no-store`.

| Parámetro | Obligatorio | Uso |
|---|---|---|
| `date` | No | Fecha local de salida (`YYYY-MM-DD`). Sin ella: desde ahora hasta el horizonte de §6. |
| `cooperativeId` | No | UUID. Limita la lista a una cooperativa; la usa la boletería. |

Respuesta: el mismo formato de SEARCH-01 (`trips`, `truncated`) más `stopCount` (paradas intermedias). Cada viaje se lista **una sola vez, con su recorrido completo** (primera a última parada), para que la lista no se multiplique por cada combinación de tramos. Orden: hora de salida y luego id. Límite: 50 resultados más el indicador de truncamiento. Errores: 400 `SEARCH_INVALID` si un parámetro no es válido y 503 `SEARCH_UNAVAILABLE` si la fuente falla (nunca una lista vacía falsa).

### 4.2 Backend

- **Route Sheets:** un método nuevo `findUpcoming({ from, to, cooperativeId, limit })` en `create-public-trip-search.js`. Lee solo sus tablas (`route_sheet_trips` con hoja `PUBLISHED`, `departure_at` entre `from` y `to`, usando el índice `(cooperative_id, departure_at)`) y revalida cada candidato con `findBookableForSegment` desde la posición 0 hasta la última. Sin migraciones.
- **Search:** validación nueva (`upcoming-request.js`) y caso de uso `listUpcoming`, que agrega el nombre público de la cooperativa igual que la búsqueda actual. Ruta `/upcoming` en el mismo router.

### 4.3 «Buscar viajes»

- Al cargar, sin sesión necesaria, mostrar «Próximas salidas», agrupadas por día («Hoy», «Mañana», «jueves 13 de noviembre»…). Cada tarjeta muestra recorrido, paradas, cooperativa, salida, llegada y tarifa base, y el botón «Ver asientos» lleva a la reserva con el recorrido completo.
- Al buscar con el formulario, los resultados reemplazan la lista. El botón «Ver todas las próximas salidas» la recupera.
- La fecha del formulario empieza en hoy.
- Estados de carga, vacío («No hay salidas a la venta en los próximos días») y error, iguales a los actuales.

### 4.4 «Vender en boletería» (ajustado por Edwin)

- Al entrar, el paso 1 muestra una **tabla con los viajes del día** de la cooperativa del oficinista (`date` y `cooperativeId` de la sesión), empezando por hoy. Botones «Día anterior» y «Día siguiente» y un selector de fecha permiten ver los viajes de cada día.
- Columnas: salida, llegada, recorrido, paradas, tarifa base y la acción «Vender», que pasa directo al mapa de asientos.
- El formulario de búsqueda sigue disponible para vender un tramo con parada intermedia.

## 5. Fuera de alcance

- Filtros por tipo de asiento, chasis y carrocería, o viaje directo o con paradas (CL-05 a CL-07).
- Un selector visible de cooperativa en la pantalla pública (CL-04). La API lo admite, pero la interfaz se deja para otra tarea.
- Catálogo de ciudades o autocompletado de origen y destino.

## 6. Decisiones (Edwin aprobó las recomendaciones el 11 de noviembre de 2026)

| Pregunta | Recomendación |
|---|---|
| Horizonte cuando no se indica fecha | 7 días |
| Máximo de salidas mostradas | 50, con aviso si hay más |
| ¿Listar también tramos intermedios? | No: recorrido completo; los tramos se buscan con el formulario |
| ¿Recargar la lista sola cada cierto tiempo? | No; botón «Actualizar» |

## 7. Criterios de aceptación

- [ ] Al abrir «Buscar viajes» sin escribir nada aparecen las salidas publicadas y vendibles de los próximos 7 días, ordenadas por hora.
- [ ] No aparecen viajes de hojas en borrador, ya salidos, fuera de la ventana de dos ciclos ni de frecuencias inactivas.
- [ ] «Ver asientos» desde la lista abre la reserva del recorrido completo.
- [ ] Buscar con el formulario sigue funcionando como hoy.
- [ ] En boletería, el oficinista ve al entrar una tabla con los viajes de hoy de su cooperativa y puede cambiar de día.
- [ ] Con la fuente caída se muestra un error, no una lista vacía.
- [ ] Sin desplazamiento horizontal a 375 px.

## 8. Pruebas esperadas

- **Unitarias:** validación de parámetros; proyección sin datos privados; agrupación por día y textos de la pantalla.
- **Integración con PostgreSQL aislado:** hoja publicada frente a borrador, viaje ya salido, frecuencia inactiva, filtro por cooperativa, límite y truncamiento, y fuente averiada.
- **Frontend:** controladores de la lista en «Buscar viajes» y en boletería.
- **Manual:** Docker con los viajes de QA Andina y de una segunda cooperativa.

## 9. Plan por tareas

| Tarea | Contenido | Commit sugerido |
|---|---|---|
| T1 | `findUpcoming` en Route Sheets y `/api/v1/trips/upcoming` en Search, con pruebas | `feat(busqueda): lista las próximas salidas a la venta` |
| T2 | «Próximas salidas» en «Buscar viajes» | `feat(web): muestra las próximas salidas al buscar viajes` |
| T3 | Tabla de viajes por día de la cooperativa en «Vender en boletería» | `feat(web): muestra las salidas de la cooperativa en boletería` |
| T4 | Recorrido en Docker y evidencias | — |

## 9 bis. Implementación y evidencias (11 de noviembre de 2026)

**Backend:**
- Route Sheets: `findUpcoming` en `infrastructure/create-public-trip-search.js`. Lee hojas `PUBLISHED` con salida futura; sin fecha, los próximos 7 días; con fecha, ese día de Ecuador. Filtro opcional por cooperativa y revalidación de cada viaje con `findBookableForSegment` sobre el recorrido completo.
- Search: `domain/upcoming-request.js`, `application/list-upcoming.js` (7 días y 50 resultados) y la ruta `GET /api/v1/trips/upcoming`. La búsqueda de SEARCH-01 no cambió. Sin migraciones.
- Pruebas: 8 unitarias (`tests/unit/search/list-upcoming.test.js`). En `tests/integration/route-sheets/trip-queries.test.js` se agregó una prueba nueva, sin cambiar las existentes: viaje nocturno por fecha local, filtro por cooperativa, otra cooperativa vacía, sin fecha fuera del horizonte, parámetros inválidos (400) y frecuencia inactiva.
- Suite completa en PostgreSQL aislado: lint y formato en verde, 2232 unitarias y 749 de integración.

**Frontend:**
- `src/search/upcoming.js` (consulta, validación, agrupación por día local, «Hoy» y «Mañana») y `tests/search/upcoming.test.js` (7 pruebas).
- «Buscar viajes»: sección «Próximas salidas» al abrir, con botón «Actualizar». La búsqueda la reemplaza y «Ver todas las próximas salidas» la recupera. La fecha empieza en hoy y no admite días pasados. Las tarjetas muestran también las paradas.
- «Vender en boletería»: paso 1 con una tabla de viajes del día de la cooperativa (salida, llegada, recorrido, paradas, tarifa y «Vender»), con «Día anterior», selector de fecha, «Día siguiente» y «Hoy», sin bajar de hoy. La venta de un tramo intermedio quedó en «Vender un tramo con parada intermedia».
- Frontend: 478 de 478, lint en verde.

**Docker QA y navegador:** `/api/v1/trips/upcoming` sin parámetros devuelve Ambato → Quito del 12/11 a las 08:30 (QA Andina, directo, $5,50), y `?date=hoy` responde 400. En «Buscar viajes» aparece bajo «Mañana» sin escribir nada; buscar y volver funciona. En boletería, «Hoy · 0 viajes» y, con «Día siguiente», «Mañana · 1 viaje»; «Vender» abre el mapa de 42 asientos y no se puede retroceder antes de hoy. A 375 px no hay desbordes: la tabla se desplaza dentro de su recuadro. Se corrigió una etiqueta oculta de la tabla que ensanchaba la página en el teléfono.

## 10. Defecto inducido

No aplica.

## 11. Revisión

Borrador preparado con asistencia de IA el 11 de noviembre de 2026 e implementado el mismo día por pedido de Edwin. Revisión de David pendiente. Sin commits.
