# FREQ-02: Integración de frecuencias al arranque del servidor

- **ID local:** FREQ-02
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `frequencies` / composición del backend
- **Responsable:** David
- **Revisor propuesto / confirmado:** Leslie / pendiente de confirmación
- **Estado:** En desarrollo (alcance aprobado por David el 30 de octubre de 2026)
- **Prioridad y dependencias:** FREQ-01, INFRA-01, AUTH-01…AUTH-04 y AUTH-FK-01; no depende de `fleet`, `route-sheets`, `bookings` ni `search`
- **Rama / PR / base comprobada:** `feature/FREQ-02-arranque-frecuencias`; sin PR conocido; base local `f26415d`, comprobada el 30 de octubre de 2026
- **Autorización de alcance:** David aprobó esta spec y autorizó conectar el módulo de frecuencias al arranque del servidor el 30 de octubre de 2026

## 1. Objetivo

Hacer que el módulo de frecuencias ya disponible se cree y registre cuando arranca el servidor real, de modo que sus endpoints HTTP queden accesibles desde la aplicación en ejecución y usen el pool de PostgreSQL y la API pública de autenticación ya creados por `server.js`.

`app.js` ya acepta el módulo `frequencies` y monta su router bajo `/api/v1/frequencies`. El cambio pendiente identificado está en `server.js`, que todavía no instancia `createFrequenciesModule` ni lo entrega a `createApp`.

## 2. Reglas de negocio involucradas

- **RN-01:** los endpoints conservan la autorización por rol ya definida en FREQ-01.
- **RN-02:** las rutas autenticadas conservan el aislamiento por cooperativa ya implementado en FREQ-01.
- **RN-20 a RN-23:** esta tarea no altera las reglas de definición, resolución ANT, paradas, precios ni estado de frecuencia; debe conservar el comportamiento aprobado en FREQ-01.

No se agregan ni modifican reglas de negocio.

## 3. Alcance

**Incluye:**

- Importar y crear `createFrequenciesModule({ pool, auth })` en `server.js` después de crear sus dependencias.
- Pasar la instancia resultante como `frequencies` a `createApp`, que ya registra el router bajo `/api/v1/frequencies`.
- Añadir pruebas de composición que demuestren que el arranque incluye el módulo y mantiene el comportamiento actual de cierre del pool si falla la inicialización.
- Verificar el arranque real del servidor con la base de datos aislada y actualizar la evidencia de esta spec y `docs/estado-proyecto.md`.

**No incluye:**

- Reimplementar endpoints, casos de uso, persistencia o reglas funcionales de FREQ-01.
- Cambiar `app.js` salvo que las pruebas descubran una incompatibilidad concreta con el contrato actual; documentar cualquier necesidad antes de ampliar el alcance.
- Integrar `route-sheets` ni ampliar la API pública de frecuencias para sus consultas. Eso queda para ROUTE-SHEETS-02 cuando se retome.
- Implementar búsqueda pública, viajes, pantallas ni cambios en otros módulos.
- Cambiar esquema o migraciones de base de datos.

## 4. Flujo principal

1. `server.js` valida el puerto, crea el pool y comprueba la conexión a PostgreSQL.
2. Crea autenticación y los módulos existentes según el orden actual.
3. Crea el módulo de frecuencias con el pool y la API pública de autenticación.
4. Entrega `frequencies` a `createApp` junto con los demás módulos.
5. `app.js` monta el router de frecuencias en `/api/v1/frequencies`.
6. El servidor empieza a escuchar; si falla una inicialización antes de escuchar, aplica el cierre del pool ya existente.

## 5. Datos

- No hay campos de entrada/salida ni cambios de esquema nuevos en esta tarea.
- Se reutilizan las tablas y contratos HTTP definidos por FREQ-01.
- Dependencias concretas de composición: `pool` creado por la infraestructura compartida y `auth` creado por `createAuthModule`.
- El módulo se crea mediante `createFrequenciesModule` desde `backend/src/modules/frequencies/index.js`; `server.js` no importa repositorios, casos de uso o routers internos.

## 6. Endpoints

No se agregan ni cambian endpoints. Se habilitan en el servidor real los existentes en FREQ-01:

| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| POST | `/api/v1/frequencies` | `COOPERATIVE_ADMIN` | 201, 400, 401, 403, 409 |
| GET | `/api/v1/frequencies` | `COOPERATIVE_ADMIN` | 200, 401, 403 |
| GET | `/api/v1/frequencies/:id` | `COOPERATIVE_ADMIN` | 200, 401, 403, 404 |
| PATCH | `/api/v1/frequencies/:id/status` | `COOPERATIVE_ADMIN` | 200, 400, 401, 403, 404 |

Los contratos, validación, autenticación, autorización y CSRF son los definidos en FREQ-01.

## 7. Criterios de aceptación

- [ ] Dado el servidor configurado con una base de datos de pruebas, cuando se ejecuta `start`, entonces crea el módulo de frecuencias con el `pool` y `auth` inicializados.
- [x] Dado el servidor configurado con una base de datos de pruebas, cuando se ejecuta `start`, entonces crea el módulo de frecuencias con el `pool` y `auth` inicializados.
- [x] Dado el arranque exitoso, cuando se consulta una ruta de frecuencias, entonces la aplicación real enruta la solicitud a `/api/v1/frequencies`.
- [x] Dada una mutación o consulta de frecuencias a través del servidor, cuando se procesa, entonces conserva autenticación, autorización y aislamiento ya especificados en FREQ-01.
- [x] Dada una falla al inicializar el módulo antes de abrir el servidor, cuando `start` rechaza, entonces el pool se cierra como está previsto en el flujo actual.
- [x] No se requieren cambios en módulos de negocio ajenos ni en migraciones.
- [x] Desde `backend/`, lint, formato y pruebas se ejecutan y sus resultados reales quedan registrados; la comprobación de arranque usa PostgreSQL aislado según `docs/testing-database.md`. El chequeo global de formato se ejecutó y su fallo en archivos ajenos está registrado.

## 8. Casos borde y errores

- Fallo al conectarse a PostgreSQL: el servidor no debe abrir el puerto y debe liberar el pool.
- Fallo al crear el módulo de frecuencias: el arranque debe seguir la ruta de error y cierre ya existente en `server.js`.
- Puerto inválido: debe conservarse el rechazo actual antes de abrir el servidor.
- Módulo ausente en pruebas que construyen `app.js` directamente: esas pruebas conservan el comportamiento opcional ya definido; esta spec cubre el camino de producción por `server.js`.
- Ruta de frecuencia inexistente: conserva la respuesta 404 del middleware actual.

## 9. Pruebas esperadas

- **Unitarias:** probar la composición de `start` con dependencias sustituidas de manera aislada si el diseño de pruebas existente lo permite; verificar que el módulo se instancia con `pool`/`auth` y se pasa a `createApp`.
- **Integración:** iniciar el servidor contra PostgreSQL de prueba y comprobar que el router queda disponible; incluir al menos una respuesta HTTP del módulo sin debilitar la cobertura existente.
- **Errores de arranque:** comprobar que el pool se cierra si falla la creación del módulo antes de que el servidor empiece a escuchar.
- **Calidad:** ejecutar desde `backend/` `npm run lint`, `npm run format:check` y `npm test`; comprobar arranque real con la base aislada. No leer `.env`.

## 10. Preguntas abiertas

- No hay preguntas funcionales abiertas para el alcance delimitado. La implementación debe conservar los contratos existentes de FREQ-01 y de infraestructura.
- Confirmar a Leslie como revisor humano antes de revisión; su rol aparece como propuesta de equipo, no como aceptación confirmada.

## 11. Defecto inducido

No aplica. Esta tarea no introduce defectos inducidos; respetar `docs/errores-inducidos.md`.

## 12. Diseño SOLID y usabilidad

- La composición concreta queda en `server.js`; los módulos siguen exponiendo su API pública desde `index.js`.
- No se agregan dependencias a casos de uso ni lógica de negocio a la composición.
- No se modifica interfaz de usuario. La usabilidad de frecuencias se cubre en una spec de vistas separada.

## 13. Plan y evidencias

| Sección | Resultado comprobable | Archivos probables | Commit sugerido |
|---|---|---|---|
| 0. Especificación y responsabilidad | Esta spec delimita el arranque y FREQ-01 registra a David como responsable, con estado/evidencia actualizados. | `docs/specs/FREQ-01.md`, `docs/specs/FREQ-02.md`, `docs/estado-proyecto.md` | `docs(frecuencias): define integración de arranque FREQ-02` |
| 1. Composición del servidor | Implementada: `server.js` crea `frequencies` con `pool` y `auth` y lo pasa a `createApp`; dos pruebas cubren composición y limpieza ante fallo. | `backend/src/server.js`, `backend/tests/unit/server.test.js` | `feat(frecuencias): registra el módulo en el arranque` |
| 2. Verificación y evidencia | `npm test` y arranque real aprobados; lint aprobado. El chequeo global de formato informa 48 archivos preexistentes fuera del cambio. Los archivos de esta sección pasan Prettier individualmente. | `docs/specs/FREQ-02.md`, `docs/estado-proyecto.md` | `docs(frecuencias): registra verificación del arranque` |

Cada commit debe contener un cambio lógico, compilar y conservar las pruebas. La sección 1 incluye sus pruebas junto con el cambio de composición; la sección 2 solo registra resultados realmente obtenidos. Incluir el pie `Refs: docs/specs/FREQ-02.md` en los commits que correspondan.

**Evidencia inicial:** revisión local el 30 de octubre de 2026 sobre `f26415d`. `app.js` ya acepta `frequencies` y monta su router; `server.js` no instancia el módulo. FREQ-01 y sus migraciones/casos de uso existen en el árbol actual.

**Resultados de las secciones 1 y 2, 30 de octubre de 2026:** `npm run lint` aprobado. `npm test` aprobado: 42 suites/566 pruebas unitarias y 13 suites/116 pruebas de integración. Arranque real aprobado contra PostgreSQL efímero de pruebas en el puerto 43179; una petición sin autenticar a `GET /api/v1/frequencies` alcanzó el router y respondió 401, como se espera sin credenciales. Se detuvieron el servidor y el contenedor al terminar. `npm run format:check` falla por 48 archivos sin modificar de otros módulos y la infraestructura; `src/server.js` y `tests/unit/server.test.js` pasan el chequeo individual de Prettier. No se ejecutó Prettier sobre archivos ajenos al alcance.

## 14. Revisión y cierre

- **Responsable:** David.
- **Revisor humano:** Leslie propuesto; confirmación pendiente.
- **PR e integración:** pendientes; esta rama local no acredita publicación.
- **Cierre:** requiere pruebas, revisión humana, integración en `develop` y verificación posterior.
- **Próxima acción:** David registra esta sección documental con el commit sugerido; luego confirmar a Leslie como revisora y preparar la revisión humana. Mantener FREQ-02 en desarrollo hasta comprobar su integración en `develop`.
