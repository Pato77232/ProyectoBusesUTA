# FREQ-01: Módulo de frecuencias

- **ID local:** FREQ-01
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `frequencies`
- **Responsable:** David
- **Estado:** **Aprobada** (18 de octubre de 2026). Preguntas cerradas por el responsable; implementación autorizada en la rama `feature/frecuencias`.
- **Reglas:** RN-02, RN-20, RN-21, RN-22, RN-23. Depende de INFRA-01/INFRA-02, AUTH-01…AUTH-04, AUTH-FK-01 y TENANTS-01. ADR 0001, ADR 0002. Resuelve la pregunta abierta 4 de `docs/business-rules.md` (precio por tramo).

## 1. Objetivo

Permitir al Usuario de Cooperativa (Administrador Operativo, `COOPERATIVE_ADMIN`) registrar y gestionar las frecuencias habilitadas legalmente de su cooperativa, incluidos los **precios por tramo** de su ruta. La frecuencia es la unidad base sobre la que luego se construyen las hojas de ruta (RN-30), la búsqueda consolidada (RN-23) y los viajes.

## 2. Reglas de negocio involucradas

- **RN-02 (multi-tenant):** la frecuencia pertenece a la cooperativa del usuario autenticado. El `cooperative_id` proviene de la sesión (`req.auth.user.cooperative_id`), nunca del cuerpo de la petición. Los repositorios siempre filtran por `cooperative_id`. La consulta pública de frecuencias es de **solo lectura** y es la única que cruza cooperativas, de forma explícita (base de la búsqueda consolidada).
- **RN-20:** una frecuencia se define por **origen, destino y hora de salida**; esos tres valores son **inmutables** una vez creada. No se implementa ningún endpoint que los modifique.
- **RN-21:** toda frecuencia exige un **número de resolución de la ANT** obligatorio y no vacío; no tiene patrón de formato (acuerdo cerrado).
- **RN-22:** una frecuencia es directa (sin escalas) o tiene **paradas intermedias autorizadas**, enviadas como lista ordenada. Las paradas se asignan **solo en la creación** y no se editan después (acuerdo cerrado).
- **RN-23:** una frecuencia está *Activa* (`ACTIVE`) o *Inactiva* (`INACTIVE`) según la estrategia comercial; el estado cambia por acción explícita del usuario. Solo las *Activas* se ofrecen en la búsqueda pública.
- **Precio por tramo (acuerdo que resuelve la pregunta abierta 4):** el precio se define **por tramo** entre puntos consecutivos de la ruta. La ruta se compone de `[origen, ...paradas, destino]`; en una ruta con paradas **se ingresan todos los precios de todos los tramos**, obligatoriamente y en orden. En una ruta directa hay un único tramo con un único precio. Los montos se expresan en USD (moneda de curso legal en Ecuador); no hay columna de moneda en esta fase.

## 3. Alcance

**Incluye:**
- Crear una frecuencia con o sin paradas intermedias y con **todos los precios de sus tramos**.
- Consultar una frecuencia por id (dentro de la propia cooperativa).
- Listar las frecuencias de la propia cooperativa con filtros.
- Cambiar el estado Activa/Inactiva (RN-23).
- Exponer por la API pública del módulo (`index.js`) la consulta de frecuencias activas que consumirá el módulo `search` (sección 6.1).
- Migración nueva de las tablas `frequencies`, `frequency_stops` y `frequency_segment_prices`.

**No incluye:**
- Modificar origen, destino u hora de salida (RN-20: se cumple por ausencia de endpoint).
- Editar paradas, precios por tramo o resolución ANT después de creados: quedan fijos con la frecuencia (acuerdo cerrado; se cumple por ausencia de endpoint). Un cambio de precio posterior requerirá spec propia.
- Descuentos automáticos (RN-43) y cálculo de cobro: pertenecen a `bookings`; allí se aplicarán sobre el tramo comprado.
- Endpoint HTTP de búsqueda pública ni resultados con bus o cooperativa: módulos `search` y `tenants` con sus propias specs.
- Hojas de ruta, grupos de buses, viajes, venta de pasajes.
- Altas de personal (COOPERATIVE_ADMIN/CLERK) y asignación de administrador operativo: specs pendientes; las pruebas de integración crearán usuarios directamente en la base de pruebas, como en TENANTS-01.
- Frontend. El rol Chofer/Controlador (fuera de fase).

## 4. Flujo principal

1. El Usuario de Cooperativa autenticado envía origen, destino, hora de salida, resolución ANT, estado opcional, paradas opcionales y la lista de precios por tramo; las mutaciones exigen CSRF (mismo patrón que `tenants`).
2. La capa `interfaces` valida el formato de entrada y rechaza propiedades no previstas; las reglas de negocio viven en `domain`/`application`.
3. El caso de uso toma el `cooperative_id` de `req.auth.user.cooperative_id` (RN-02) y aplica las reglas de dominio: resolución ANT obligatoria no vacía, origen distinto de destino, paradas sin duplicados ni iguales al origen/destino, y **exactamente un precio por tramo** (`stops.length + 1` montos, todos > 0).
4. Verifica que no exista ya una frecuencia idéntica (mismo origen, destino y hora) **en la misma cooperativa**; la restricción única en BD cubre el caso concurrente.
5. Se guarda la frecuencia con sus paradas ordenadas y sus precios de tramo, y se responde 201.

## 5. Datos

**Entrada (POST):**

| Campo | Tipo | Validación |
|---|---|---|
| origin | texto | obligatorio, no vacío, distinto de `destination` |
| destination | texto | obligatorio, no vacío |
| departure_time | hora `HH:mm` | obligatorio, formato 24 h válido |
| ant_resolution_number | texto | obligatorio, no vacío tras trim; sin patrón de formato |
| status | `ACTIVE` \| `INACTIVE` | opcional, por defecto `ACTIVE` |
| stops | lista ordenada de textos | opcional; no repite lugares, no incluye origen ni destino; sin límite de cantidad (acuerdo cerrado; aplica el límite de cuerpo JSON de Express) |
| segment_prices | lista de montos numéricos | **obligatoria**; exactamente `stops.length + 1` valores (uno por tramo, en orden de la ruta); cada monto > 0, máximo 2 decimales |

**Salida:** `{ frequency: { id, cooperative_id, origin, destination, departure_time, ant_resolution_number, status, stops, segment_prices, created_at, updated_at } }` (envoltorio `frequencies` en el listado). `segment_prices` se devuelve como lista de montos en orden de ruta.

**Cambios de base de datos (migración nueva; nunca editar migraciones existentes):**
- Tabla `frequencies`: `id` uuid PK default `gen_random_uuid()`, `cooperative_id` uuid NOT NULL con FK a `cooperatives(id)` (`ON DELETE RESTRICT`, como la FK de `users`), `origin` text NOT NULL, `destination` text NOT NULL, `departure_time` time NOT NULL, `ant_resolution_number` text NOT NULL, `status` text NOT NULL default `'ACTIVE'` con check `IN ('ACTIVE','INACTIVE')`, `created_at`, `updated_at`.
- Restricción única `frequencies_cooperative_route_unique`: (`cooperative_id`, `origin`, `destination`, `departure_time`) — traduce RN-20 y el duplicado por cooperativa.
- Tabla `frequency_stops`: `id` uuid PK, `frequency_id` uuid NOT NULL FK a `frequencies(id)` en cascada, `position` integer NOT NULL, `place` text NOT NULL; única (`frequency_id`, `position`).
- Tabla `frequency_segment_prices`: `id` uuid PK, `frequency_id` uuid NOT NULL FK a `frequencies(id)` en cascada, `from_position` integer NOT NULL (posición del punto de partida en la ruta), `to_position` integer NOT NULL (punto de llegada), `amount` numeric(10,2) NOT NULL con check `amount > 0`; única (`frequency_id`, `from_position`). El tramo `n` une el punto `n` y `n+1` de `[origin, ...stops, destination]`.
- Reversible (`down` elimina las tres tablas nuevas).
- **Rendimiento:** el índice que ya deriva de la restricción única (col. inicial `cooperative_id`) cubre el listado y los filtros por ruta dentro de una cooperativa; no se agregan más índices en esta fase.
- Todo filtro por `cooperative_id` en los repositorios; ninguna consulta autenticada cruce cooperativas.

## 6. Endpoints

| Método | Ruta | Roles | CSRF | Respuestas |
|---|---|---|---|---|
| POST | /api/v1/frequencies | COOPERATIVE_ADMIN | sí | 201, 400, 401, 403, 409 |
| GET | /api/v1/frequencies | COOPERATIVE_ADMIN | no | 200, 401, 403 |
| GET | /api/v1/frequencies/:id | COOPERATIVE_ADMIN | no | 200, 401, 403, 404 |
| PATCH | /api/v1/frequencies/:id/status | COOPERATIVE_ADMIN | sí | 200, 400, 401, 403, 404 |

**Filtros del listado (query string, todos opcionales y combinables con AND):**
- `status=ACTIVE|INACTIVE` — valor exacto.
- `origin=<texto>`, `destination=<texto>` — coincidencia exacta normalizada (trim + minúsculas), para evitar variantes de mayúsculas.
- Sin paginación en esta fase: el volumen por cooperativa es acotado; si crece, se añadirá `limit`/`offset` en una tarea futura con spec propia.

**Códigos de error:** `VALIDATION_ERROR` (400), `FREQUENCY_REQUIRES_ANT_RESOLUTION` (400), `FREQUENCY_SEGMENT_PRICES_MISMATCH` (400, cantidad de montos distinta a la de tramos), `FREQUENCY_ALREADY_EXISTS` (409), `FREQUENCY_NOT_FOUND` (404), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `CSRF_TOKEN_INVALID` (403). Formato único `{ "error": { "code", "message" } }`; traducción de errores de dominio en el router del módulo y fallback al middleware global, igual que `tenants`.

**Autorización y tenancy:** se usa exclusivamente la API pública de `auth` (`authenticate`, `authorize('COOPERATIVE_ADMIN')`, `csrfProtection`). RN-01: CUSTOMER, CLERK y SYSTEM_ADMIN reciben 403. Una frecuencia de otra cooperativa responde **404** (no 403) para no revelar su existencia; el repositorio filtra por `cooperative_id` en toda consulta, incluida la mutación de estado.

No existe endpoint PUT/PATCH sobre `origin`, `destination`, `departure_time`, `stops` ni precios; un intento cae en 404 por ruta inexistente (RN-20 y acuerdos cerrados).

### 6.1 API pública del módulo para la búsqueda (futura, módulo `search`)

Diseño encargado por el responsable; respeta la regla de dependencias de `architecture.md` ("el módulo A define un puerto y B lo implementa a través de su API pública"), RN-02 y RN-23:

- `frequencies/index.js` expone `findActiveByRoute({ origin, destination })`: devuelve las frecuencias **activas** de **todas** las cooperativas que coincidan con la ruta (normalizada trim + minúsculas), con `id`, `cooperative_id`, `origin`, `destination`, `departure_time`, `stops` ordenadas y `segment_prices` (el valor que la búsqueda mostrará). Solo lectura; nunca devuelve `ant_resolution_number` ni datos internos.
- Sin endpoint HTTP todavía: `search` consumirá esta función desde su composición, definiendo en **su** dominio el puerto correspondiente e inyectando la implementación desde `frequencies/index.js`, según `architecture.md` §4. El contrato se fija aquí para que la spec de `search` no tenga que entrar en las carpetas internas de `frequencies`.
- Los datos que la búsqueda aún no puede mostrar (nombre de cooperativa, bus) se obtendrán de `tenants` y `route-sheets`; quedan fuera de FREQ-01.
- Esta función no aplica paginación por ahora; el futuro contrato con `search` la definirá si hace falta.

## 7. Criterios de aceptación

- [ ] Dado un usuario de cooperativa autenticado con CSRF, cuando crea una frecuencia válida, entonces recibe 201 y la frecuencia queda ligada a su cooperativa.
- [ ] Dado un cuerpo sin resolución ANT o con él en blanco, cuando crea la frecuencia, entonces recibe 400 con el código `FREQUENCY_REQUIRES_ANT_RESOLUTION`.
- [ ] Dada una ruta directa, cuando envía un único precio de tramo, entonces se guarda; si envía cero precios o dos, recibe 400 `FREQUENCY_SEGMENT_PRICES_MISMATCH`.
- [ ] Dada una ruta con N paradas, cuando envía exactamente N+1 precios, entonces se guardan en orden; si envía menos o más, recibe 400 `FREQUENCY_SEGMENT_PRICES_MISMATCH`.
- [ ] Dado un precio igual a 0 o negativo, cuando crea la frecuencia, entonces recibe 400 `VALIDATION_ERROR`.
- [ ] Dada una frecuencia existente en la cooperativa, cuando intenta crear otra con el mismo origen, destino y hora, entonces recibe 409 `FREQUENCY_ALREADY_EXISTS`.
- [ ] Dada una misma combinación origen/destino/hora en **otra** cooperativa, cuando la crea, entonces recibe 201 (el duplicado se evalúa por cooperativa).
- [ ] Dada una frecuencia de otra cooperativa, cuando se consulta por id o se cambia su estado, entonces recibe 404.
- [ ] Cuando lista las frecuencias con filtros `status`, `origin` o `destination`, entonces solo recibe las de su cooperativa que cumplen el criterio.
- [ ] Dada una frecuencia, cuando cambia el estado a `INACTIVE`, entonces recibe 200 y el estado persiste.
- [ ] No existe ningún endpoint para modificar origen, destino, hora de salida, paradas ni precios (RN-20 y acuerdos cerrados).
- [ ] Un CUSTOMER, CLERK o SYSTEM_ADMIN recibe 403; sin token, 401; sin CSRF en mutaciones, 403 `CSRF_TOKEN_INVALID`.
- [ ] El `cooperative_id` enviado en el cuerpo, si viene, se ignora: manda el de la sesión.
- [ ] Dada una frecuencia activa de otra cooperativa, cuando se invoca `findActiveByRoute`, entonces aparece en el resultado con sus precios de tramo (solo lectura, RN-02); las inactivas nunca aparecen (RN-23).

## 8. Casos borde y errores

- Origen igual a destino.
- Parada repetida, vacía o igual al origen o al destino.
- Hora con formato inválido (`25:00`, `14:60`, texto).
- Número de resolución ANT en blanco o solo espacios (sin exigir patrón).
- Cantidad de precios distinta a la de tramos (ruta directa: 1 tramo; con paradas: paradas + 1).
- Precio en 0, negativo, con más de 2 decimales o no numérico.
- Cambiar estado de una frecuencia ya inactiva: idempotente, responde 200.
- Filtro `status` con valor desconocido: 400 `VALIDATION_ERROR`.
- `id` inexistente o mal formado en la ruta.
- Concurrencia: dos peticiones simultáneas con la misma combinación en la cooperativa → una sola 201, la otra 409 (restricción única en BD).
- Campos extra en el cuerpo: 400 (mismo criterio que TENANTS-01).
- `findActiveByRoute` con origen igual a destino: devuelve lista vacía (no es una ruta válida).

## 9. Pruebas esperadas

- **Unitarias** (`backend/tests/unit/frequencies/`):
  - Entidad `Frequency`: inmutabilidad de origen/destino/hora (RN-20), resolución ANT obligatoria no vacía sin patrón (RN-21), estado por defecto (RN-23).
  - Validación de paradas: sin duplicados, sin repetir origen/destino, sin límite de cantidad (RN-22).
  - Precios por tramo: exactamente `stops.length + 1`, todos > 0, en orden (acuerdo que resuelve la pregunta abierta 4).
  - Casos de uso `CreateFrequency`, `GetFrequency`, `ListFrequencies` (con filtros), `ChangeFrequencyStatus` y `findActiveByRoute` con repositorio simulado: éxito, duplicado, no encontrado, lista vacía y errores de dominio.
  - Cada regla RN-20, RN-21, RN-22 y RN-23 tiene al menos una prueba.
- **Integración** (`backend/tests/integration/frequencies/`):
  - Migración aplicable y reversible junto con las existentes.
  - Repositorio PostgreSQL: persistencia y lectura de paradas y precios por tramo.
  - Endpoints con sesión real: éxito, roles incorrectos, CSRF, filtros del listado y aislamiento entre cooperativas (RN-02).
  - Concurrencia contra BD real. Conservar todas las pruebas previas intactas.

## 10. Acuerdos cerrados (18 de octubre de 2026) y decisiones de diseño

1. **Paradas:** no se pueden editar; se asignan únicamente al crear la frecuencia. Se cumple por ausencia de endpoint de edición.
2. **Resolución ANT:** sin patrón específico; solo se exige no vacío (tras trim).
3. **Listado con filtros:** decisión de diseño — `status`, `origin` y `destination`, combinables, normalización trim + minúsculas, sin paginación ni índices adicionales (justificado en §5 y §6).
4. **Paradas:** sin límite de cantidad; aplica el límite de cuerpo JSON de Express.
5. **Precio:** **por tramo**; en rutas con paradas se ingresan **todos** los tramos, obligatorios y en orden (justificado en §2 y §5). Resuelve la pregunta abierta 4 de `docs/business-rules.md`; convendrá actualizar ese documento con el equipo.
6. **Búsqueda pública:** decisión de diseño — contrato `findActiveByRoute` en la API pública del módulo, puerto definido por `search` e inyectado en su composición (§6.1); sin endpoint HTTP en FREQ-01.
7. **Rama:** se trabaja en **`feature/frecuencias`** (decisión del equipo; excepción documentada al patrón `feature/<ID-spec>-<descripcion>` de `conventions.md` §5).
8. **Commits:** mensajes entregados en §12 conforme a `conventions.md`; los realiza el humano.

## 11. Defecto inducido (solo si aplica)

**No aplica.** Esta spec no introduce defectos inducidos. Según `docs/errores-inducidos.md`, cualquier defecto académico debe definirse y autorizarse primero en una spec propia, con su ID, propósito, reproducción y prueba que lo evidencia. No se introduce ninguno automáticamente.

## 12. Plan de implementación por capas

Orden de construcción según `architecture.md` §4: los datos habilitan la infraestructura, el dominio no depende de nada, la aplicación depende solo del dominio y las interfaces solo traducen HTTP. Una sesión por tarea; cada tarea termina con `npm run lint`, `npm run format:check` y `npm test` (reportando resultados reales). **Los commits los ejecuta el humano** con los mensajes de la tabla (tipo en inglés, alcance `frecuencias`, imperativo, ≤72 caracteres, pie `Refs: docs/specs/FREQ-01.md`).

### Tarea 1 — Capa de datos (migración)
- Crear `backend/migrations/<timestamp>-frequencies.js`: tablas `frequencies`, `frequency_stops`, `frequency_segment_prices`, con FK, checks y restricciones de §5; `down` reversible.
- Pruebas: la prueba general de migraciones existente debe reconocerla, revertirla y reaplicarla.
- Commit: `feat(frecuencias): agrega las tablas de frecuencias y precios`

### Tarea 2 — Capa de dominio (sin dependencias)
- `domain/`: value objects (hora de salida, estado, parada, precio de tramo), entidad `Frequency` con las invariantes de §5, errores de dominio (`FrequencyRequiresAntResolutionError`, `FrequencySegmentPricesMismatchError`, `FrequencyAlreadyExistsError`, `FrequencyNotFoundError`) y puerto `FrequencyRepository`.
- Pruebas unitarias de dominio: RN-20, RN-21, RN-22, RN-23 y precios por tramo.
- Commit: `feat(frecuencias): agrega la entidad Frequency y su puerto`

### Tarea 3 — Capa de infraestructura (implementa el puerto)
- `infrastructure/pg-frequency.repository.js`: consultas parametrizadas, `WHERE cooperative_id = $1` en todas, carga de paradas y precios, manejo de violación de la restricción única → `FrequencyAlreadyExistsError`.
- Pruebas de integración del repositorio contra PostgreSQL.
- Commit: `feat(frecuencias): agrega el repositorio PostgreSQL`

### Tarea 4 — Capa de aplicación (depende solo de dominio)
- `application/`: DTOs y casos de uso `CreateFrequency`, `GetFrequency`, `ListFrequencies` (filtros), `ChangeFrequencyStatus`, con puertos inyectados (nunca instanciados).
- Pruebas unitarias con repositorio simulado (éxito y cada error de dominio).
- Commit: `feat(frecuencias): agrega los casos de uso de frecuencias`

### Tarea 5 — Capa de interfaces + composición (HTTP, sin lógica de negocio)
- `interfaces/frequency-router.js`: validación de entrada, middlewares `auth.authenticate`, `auth.authorize('COOPERATIVE_ADMIN')`, `auth.csrfProtection` en mutaciones, traducción de errores de dominio con fallback al global (patrón de `tenants`).
- Composición en `frequencies/index.js` y montaje en `app.js`.
- Pruebas de integración HTTP: éxito, 400/401/403/404/409, filtros y aislamiento entre cooperativas.
- Commit: `feat(frecuencias): agrega las rutas HTTP de frecuencias`

### Tarea 6 — API pública para búsqueda (aplicación + `index.js`)
- `application/find-active-by-route.use-case.js` (solo lectura, todas las cooperativas, `ACTIVE`) y su exposición en `frequencies/index.js`.
- Pruebas unitarias (vacío, normalización, inactivas excluidas) e integración del contrato público.
- Commit: `feat(frecuencias): expone la consulta pública de frecuencias activas`

Si las pruebas de una tarea se añaden en un commit aparte: `test(frecuencias): cubre el aislamiento entre cooperativas` (u otra acción concreta en español).
