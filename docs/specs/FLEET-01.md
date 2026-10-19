# FLEET-01: Crear y listar grupos de buses

- **ID local:** FLEET-01
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `fleet`
- **Alcance de commit:** `flota`
- **Responsable:** Edwin
- **Estado:** Aprobada
- **Base de trabajo:** rama `feature/FLEET-01-grupos-buses` desde `develop`, con `auth` y `tenants` integrados

## 1. Objetivo

Permitir al **Usuario de Cooperativa (Administrador Operativo)** crear grupos de buses para su cooperativa y listar los grupos que le pertenecen, de modo que la flota pueda organizarse por categoría operativa (RN-11) y quede disponible para las hojas de ruta (RN-30). El aislamiento multi-tenant (RN-02) se garantiza filtrando siempre por la cooperativa del usuario autenticado.

## 2. Reglas de negocio involucradas

- RN-01: cada usuario tiene exactamente un rol; el rol se valida en el backend en cada endpoint.
- RN-02: la cooperativa es un inquilino aislado; los grupos pertenecen a una cooperativa y solo su administrador operativo los ve y modifica. El `cooperative_id` sale del token, nunca del cuerpo.
- RN-11: los buses se agrupan en **Grupos** según su categoría operativa: rutas largas (alto confort), rutas cantonales (cortas, estándar) y rutas urbanas/rurales (tipo ranchera).
- RN-30: las hojas de ruta vinculan un **Grupo de Buses** con las frecuencias activas de la cooperativa; por eso los grupos deben existir antes.

## 3. Alcance

**Incluye:** un único caso de uso de creación de grupo de buses y uno de listado por cooperativa, con migración nueva, validaciones, endpoints protegidos, pruebas unitarias e integración y composición del módulo `fleet`.

**No incluye:** edición o eliminación de grupos, asignación de buses a grupos, registro de buses (RN-10), plantillas de asientos (RN-12), frecuencias, hojas de ruta, búsqueda pública, frontend ni altas de personal.

## 4. Flujo principal

### Crear grupo

1. Autenticar la sesión y exigir rol `COOPERATIVE_ADMIN` usando la API pública de `auth`.
2. Comprobar CSRF antes de procesar la creación.
3. Validar la entrada y rechazar propiedades no previstas.
4. Obtener el `cooperative_id` del usuario autenticado (del token), nunca del cuerpo.
5. Ejecutar `CreateBusGroup` con el puerto de repositorio inyectado.
6. Insertar el grupo; la base debe prevenir duplicados de nombre dentro de la misma cooperativa también ante solicitudes concurrentes.
7. Responder 201 con los datos creados.

### Listar grupos

1. Autenticar la sesión y exigir rol `COOPERATIVE_ADMIN`.
2. Obtener el `cooperative_id` del usuario autenticado.
3. Ejecutar `ListBusGroups` filtrando por `cooperative_id`.
4. Responder 200 con la lista ordenada.

## 5. Datos

### Campos del grupo

- `id`: UUID generado por el servidor.
- `cooperative_id`: UUID de la cooperativa propietaria (FK a `cooperatives.id`), tomado del token, no del cuerpo. No se expone en la respuesta.
- `name`: texto obligatorio, sin espacios exteriores, no vacío, único por cooperativa.
- `category`: texto obligatorio, uno de los valores fijos `LONG_ROUTE`, `CANTONAL`, `URBAN_RURAL` (las tres categorías de RN-11).
- `created_at` y `updated_at`: timestamptz.

**Contrato JSON de creación:** `name`, `category`. Todos los valores presentes son texto. Se recortan espacios exteriores; `name` no puede quedar vacío. No se añaden límites de longitud funcionales no acordados; aplica el límite de cuerpo JSON de Express.

**Respuesta 201:** `{ "busGroup": { "id", "name", "category", "created_at", "updated_at" } }`. No se expone `cooperative_id`.

**Respuesta 200 (listado):** `{ "busGroups": [ { "id", "name", "category", "created_at", "updated_at" } ] }`, ordenados por `name` ascendente y, en empate, por `id` ascendente. Lista vacía si la cooperativa no tiene grupos.

**Errores:** 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN` / `CSRF_TOKEN_INVALID`, 409 `BUS_GROUP_ALREADY_EXISTS`. El conflicto no expone datos de otra cooperativa.

### Migración nueva

Tabla `bus_groups`:

| Campo | Tipo | Restricción |
|---|---|---|
| id | UUID | PK, `gen_random_uuid()` |
| cooperative_id | UUID | NOT NULL, FK → `cooperatives.id` (ON DELETE RESTRICT) |
| name | TEXT | NOT NULL, `length(btrim(name)) > 0` |
| category | TEXT | NOT NULL, CHECK en (`'LONG_ROUTE'`, `'CANTONAL'`, `'URBAN_RURAL'`) |
| created_at / updated_at | timestamptz | NOT NULL |

Restricción única: `(cooperative_id, name)` (`bus_groups_cooperative_name_unique`), para evitar duplicados dentro de la misma cooperativa. Índice sobre `cooperative_id` para el listado.

Nombre de migración con timestamp mayor a `1792460000000` (por ejemplo `1792470000000-create-bus-groups.js`). No se edita ninguna migración ya fusionada.

## 6. Endpoints

| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| POST | /api/v1/bus-groups | COOPERATIVE_ADMIN | 201, 400, 401, 403, 409 |
| GET | /api/v1/bus-groups | COOPERATIVE_ADMIN | 200, 401, 403 |

## 7. Criterios de aceptación

- Administrador operativo autenticado de una cooperativa, con CSRF válido y datos válidos: 201 y persistencia del grupo en su cooperativa.
- Sin sesión o sesión revocada/vencida: 401 y ninguna inserción.
- `SYSTEM_ADMIN`, `CUSTOMER` o `CLERK`: 403 y ninguna inserción ni lectura ajena.
- Sin CSRF o con CSRF manipulado: 403 y ninguna inserción.
- Datos inválidos o campos extra: 400.
- Nombre duplicado dentro de la misma cooperativa, incluidas dos solicitudes concurrentes: una sola fila y conflicto 409.
- El `cooperative_id` no puede ser elegido ni modificado mediante el cuerpo.
- El listado devuelve únicamente los grupos de la cooperativa del usuario autenticado, ordenados por nombre; no expone grupos de otras cooperativas.
- Un usuario sin cooperativa asociada (rol interno inválido) no puede crear ni listar.

## 8. Casos borde y errores

- Nombre con espacios exteriores: se recorta; si queda vacío, 400.
- Categoría fuera del conjunto acordado: 400.
- Cuerpo vacío o con campos extra: 400.
- Dos administradores de la misma cooperativa creando el mismo nombre simultáneamente: una respuesta 201 y otra 409; una sola fila.
- Cooperativa sin grupos: listado 200 con arreglo vacío.
- Intento de borrar o editar un grupo: fuera de alcance; no se implementan rutas para ello en esta spec.

## 9. Pruebas esperadas

- Unitarias (`backend/tests/unit/fleet/`): validación de `CreateBusGroup` (entrada válida, campos extra, nombre vacío, categoría inválida), invocación del repositorio y propagación de errores; `ListBusGroups` devuelve solo los grupos de la cooperativa indicada.
- Integración (`backend/tests/integration/fleet/`): endpoints reales contra `pasajes_test`; permisos por rol; CSRF; sesión revocada; duplicados y concurrencia; aislamiento entre cooperativas (dos cooperativas, cada una solo ve sus grupos); migración reversible.
- Conservar las pruebas existentes; revisar supuestos sobre el número de migraciones antes de agregar la nueva.

## 10. Preguntas abiertas

- Confirmar con David que el grupo pertenece a la cooperativa y que la categoría es fija. Esto no bloquea la spec.
- Varios grupos por categoría: con la restricción actual, una cooperativa podría tener dos grupos `LONG_ROUTE` con nombres distintos. Si en el modelo de negocio es un grupo por categoría, `name` sobra y la restricción debería ser `(cooperative_id, category)`. Para Putumayo, con 3 grupos, parece uno por categoría. Pregúntaselo a David junto con lo ya anotado.
- Nombres que solo difieren en mayúsculas: "Rutas Largas" y "rutas largas" serían dos grupos distintos. Si quieres evitarlo, la unicidad sería sobre `lower(name)`. Es una decisión pequeña, pero hay que tomarla ahora porque la migración no se puede editar después.

## 11. Defecto inducido

No aplica.

## 12. Decisiones y dependencias

- Decisiones confirmadas: `BusGroup` pertenece a la cooperativa (`cooperative_id` sale del token, nunca del cuerpo); campos `id`, `name` (obligatorio, único por cooperativa), `category` (`LONG_ROUTE | CANTONAL | URBAN_RURAL`), `created_at`, `updated_at`; endpoints `POST`/`GET /api/v1/bus-groups` con rol `COOPERATIVE_ADMIN` y CSRF en el POST; errores 400/401/403/409; tabla `bus_groups` con migración nueva de timestamp mayor a `1792460000000`.
- Depende de `auth` (autenticación, autorización por rol y CSRF) y de `tenants` (tabla `cooperatives`).
- Depende de `AUTH-FK-01`, ya integrada en `develop` (FK `users.cooperative_id` y CHECK por rol).
- El módulo `fleet` no existe todavía; se crea en esta spec.

## 13. Arquitectura y plan (cuando se apruebe)

1. Entidad y validaciones en `domain` (`bus-group.js`), errores de dominio explícitos (`bus-group-error.js`) y puerto `BusGroupRepository`.
2. Casos de uso `CreateBusGroup` y `ListBusGroups` en `application`, dependientes solo de `domain` y del puerto inyectado.
3. Migración nueva y repositorio PostgreSQL parametrizado en `infrastructure` (`pg-bus-group.repository.js`), con filtro obligatorio por `cooperative_id`.
4. Controlador y validación HTTP en `interfaces` (`bus-group-router.js`); composición a través de `fleet/index.js`.
5. Montaje del módulo en `app.js` y `server.js` mediante su API pública.
6. Pruebas unitarias e integración contra la base aislada; lint y suite completa.

## 14. Precisiones de implementación (a confirmar)

- El `cooperative_id` del usuario autenticado se obtiene de `req.auth.user.cooperative_id`; si es null (rol sin cooperativa), responder 403.
- La validación de entrada sigue el patrón de `tenants`: validación manual en `domain` (función tipo `createBusGroupData`), sin Zod, para mantener un único patrón en el proyecto. Zod queda disponible pero no se introduce en este módulo.
- Las consultas SQL siempre incluyen `WHERE cooperative_id = $1` en el listado.
- Los errores de dominio se traducen a HTTP en el middleware centralizado de errores.
- Sin `console.log`; usar el logger de `shared`.
