# INFRA-01: Esqueleto de infraestructura del backend

- **ID local:** INFRA-01
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** infra
- **Responsable:** Pablo
- **Estado:** Aprobada. T1 y T2 implementadas (octubre 2026); T3–T5 autorizadas por Pablo al solicitar completar el módulo en esta sesión

> Decisiones §4 **aprobadas por el equipo** (octubre 2026) y reflejadas en ADR 0001 y ADR 0003 (estado *Aceptada*). La corrección del `README.md` (que contradice los ADR: Prisma, express-session, EJS) queda en una **tarea documental separada**, ya desbloqueada al estar los ADR aceptados.

## 1. Objetivo
Poner en marcha el esqueleto mínimo del backend (`backend/`) y su base de datos, con arquitectura limpia, migraciones SQL, pruebas y calidad de código, de modo que los módulos de negocio (`auth`, `tenants`, etc.) puedan desarrollarse sobre una base sólida. Responsable: Pablo.

## 2. Reglas de negocio involucradas
- Ninguna directamente. Esta spec es prerequisito técnico de todas las demás.

## 3. Alcance
**Incluye:** estructura de carpetas y scripts, Express con manejo de errores, PostgreSQL con migraciones (`node-pg-migrate`), Jest, ESLint + Prettier, Docker Compose (`backend` y `db`), base de datos de pruebas separada con protección de limpieza.
**No incluye:** frontend ni su contenedor (tarea posterior), autenticación, lógica de negocio, semilla de usuarios (pertenece a `auth`), corrección del README (tarea `docs`), aprobación formal de los ADR (proceso del equipo).

## 4. Decisiones aprobadas por el equipo (octubre 2026)
| Tema | Decisión |
|---|---|
| Estilo | Arquitectura limpia en monolito modular (ADR 0001, aceptada) |
| Runtime | Node.js **24 LTS**, imagen Docker con **versión exacta** (sin `latest`); verificar compatibilidad al implementar |
| HTTP | Express |
| BD | PostgreSQL **16**, imagen con versión exacta; sin ORM, SQL a mano |
| Migraciones | `node-pg-migrate` |
| Validación de entrada (capa `interfaces`) | Zod *(se instala cuando un módulo la necesite, no en esta spec)* |
| Logger | `pino` vía `shared/logger` (convenios: prohibido `console.log`) |
| Variables de entorno | Cargadas con el soporte nativo de Node (`--env-file`), sin dependencia `dotenv`; `.env.example` con placeholders, nunca valores reales; los `.env` no se leen ni se muestran |
| Composición | Puerto por defecto `3000` (`PORT`) |
| Nombre del paquete npm | `busesuta-backend` |

## 5. Tareas (pequeñas, una por entrega)

### T1 — Estructura y scripts *(autorizada)*
- **Dependencias de la tarea: ninguna.** No se instala ningún paquete npm en T1; `package.json` solo declara nombre, versión, licencia, `engines` y scripts. Las dependencias se enumeran, justifican e instalan en sus tareas (T2, T4, T5), con aprobación humana.
- `backend/package.json` con scripts: `start`, `dev`, `test`, `test:unit`, `test:integration`, `lint`, `lint:fix`, `migrate`, `migrate:down`.
- Estructura de carpetas según `docs/architecture.md`: `src/modules/<modulo>/{domain,application,infrastructure,interfaces}`, `src/shared/`, `src/app.js`, `src/server.js`, `migrations/`, `tests/unit/`, `tests/integration/`. En T1 solo se crean directorios (con `.gitkeep`); `app.js` y `server.js` son T2.
- `.gitignore` (incluye `.env`, `node_modules`), `.env.example` con placeholders (`PORT=3000`, `DATABASE_URL=postgresql://user:pass@localhost:5432/pasajes`, `JWT_SECRET=cambiar-en-despliegue`, `JWT_EXPIRES_IN=30m`).

**Verificación esperada de T1:** los scripts de `npm run lint` y `npm test` **fallarán por dependencias no instaladas todavía** (T4); eso es una ejecución fallida por configuración pendiente. La verificación de T1 es: `package.json` válido, directorios creados y ausencia de secretos.

### T2 — Express y manejo de errores *(autorizada e implementada)*
- **Dependencias de la tarea (aprobadas e instaladas, octubre 2026):**
  | Paquete | Versión | Justificación |
  |---|---|---|
  | `express` | `^5.3.0` | Framework HTTP decidido en el ADR 0003. Se toma la línea 5 (estable y mantenida); la versión exacta queda fijada por `package-lock.json`, que se incluye en el repositorio |
  | `pino` | `^10.4.0` | Logger de `shared/logger` (ADR 0003 y convenios: prohibido `console.log`). Salida estructurada y de bajo costo; no se instala ningún transporte adicional |
- `app.js`: `createApp()` con Express, JSON body, rutas bajo `/api/v1`, health check `GET /api/v1/health`.
- Middleware de errores en un solo punto: los errores de dominio se traducen a HTTP con formato único `{ "error": { "code": "...", "message": "..." } }` (ADR/`architecture.md` §6).
- Errores base en `shared/errors/`: `DomainError` (código + estado HTTP) y `NotFoundError`.
- 404 (`NOT_FOUND`) y `INTERNAL_ERROR` (500) con el mismo formato. Sin stack trace al cliente; el detalle solo va al log.
- Cuerpo JSON malformado → 400 `INVALID_JSON` (parte del manejo centralizado).
- `server.js`: arranque Express escuchando en `PORT` (por defecto 3000) con log por `shared/logger`.
- **Verificación:** las pruebas de T2 están escritas (`tests/unit/shared/error-handler.test.js`, `tests/integration/app.test.js`) pero **aún no se ejecutan** porque Jest y ESLint se configuran en T4. Eso es una ejecución fallida por configuración pendiente.

### T3 — PostgreSQL y migraciones
- Herramienta `node-pg-migrate` conectada por `DATABASE_URL`.
- Carpeta `migrations/` versionada; **una migración ya fusionada no se edita** (AGENTS.md).
- La primera migración de AUTH-01 (`users`, `auth_sessions`) **no** forma parte de INFRA-01: aquí solo queda la herramienta funcionando con una migración vacía o de verificación.
- Restricción: tablas en `snake_case` plural; columnas `snake_case`; `created_at`/`updated_at` en tablas de datos.

### T4 — Jest, ESLint y Prettier
- Jest configurado para `tests/unit/` y `tests/integration/`; cobertura mínima inicial de `domain`/`application` propuesta al 70 % (convenios, a acordar).
- **Base de datos de pruebas separada** (por ejemplo `pasajes_test`). Protección de limpieza: el script de limpieza/seed de pruebas **solo se ejecuta** si `NODE_ENV=test` **y** `DATABASE_URL` termina en `_test`; en caso contrario aborta con error explícito sin tocar la BD. Nunca se limpia la BD de desarrollo.
- ESLint + Prettier sin advertencias. Reglas de capas con `no-restricted-imports` (por ejemplo: `domain` no importa `pg`, Express, ni otras capas; `application` no importa `infrastructure`).
  - **Límites conocidos de `no-restricted-imports`:** se aplica por patrón/archivos con `overrides`; no entiende el grafo de dependencias entre módulos ni valida fronteras capa-a-capa de forma automática. Sirve para bloquear importaciones concretas (`pg` en `domain`, `express` fuera de `interfaces`). Si más adelante se necesitan reglas de frontera entre módulos, se evalúa `eslint-plugin-boundaries` en una tarea propia, justificándolo.
- Dependencias a instalar en esta tarea (justificadas): `jest`, `eslint`, `prettier`, `eslint-config-prettier`. *(Instalación con aprobación humana en su momento.)*

### T5 — Docker Compose
- Servicios: `backend` (Node 24, versión exacta) y `db` (PostgreSQL 16, versión exacta), con volúmenes, healthcheck de la BD y variables por archivo `.env`.
- El servicio `frontend` se incorporará en una **tarea posterior**, fuera de INFRA-01.
- Dependencias a instalar/justificar en el `Dockerfile`: ninguna además de las del `package.json` de runtime (`express`, `pg`, `pino`, `node-pg-migrate`). *(Instalar con aprobación humana.)*

## 6. Endpoints
| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| GET | /api/v1/health | Público | 200 |

## 7. Criterios de aceptación
- [ ] Dado el repositorio vacío de código, cuando se ejecuta `docker compose up`, entonces el `backend` responde 200 en `/api/v1/health` usando PostgreSQL del compose.
- [ ] Dada una ruta inexistente, cuando se consulta, entonces responde 404 con `{ "error": { "code": "...", "message": "..." } }`.
- [ ] Dado un error de dominio lanzado, cuando llega al middleware, entonces se responde el código HTTP y el formato únicos.
- [ ] Dado `npm test`, cuando se ejecuta, entonces corren las pruebas unitarias sin base de datos y las de integración contra `pasajes_test`.
- [ ] Dado un `DATABASE_URL` que no termina en `_test`, cuando se invoca la limpieza de pruebas, entonces la ejecución aborta sin modificar datos.
- [ ] Dado `npm run lint`, cuando se ejecuta, entonces termina sin advertencias.
- [ ] Dada la capa `domain`, cuando se revisa el ESLint, entonces importar `pg`, `express` o `infrastructure` falla.
- [ ] Ninguna imagen Docker usa `latest`; versiones exactas en `docker-compose.yml` y `Dockerfile`.
- [ ] No hay secretos ni `.env` en el repositorio; `.env.example` contiene solo placeholders.

## 8. Casos borde y errores
- Migración aplicada dos veces o hacia atrás (`migrate:down`) sin romper el esquema.
- Puerto ocupado (configurable por `PORT`).
- BD no disponible al arrancar: el backend falla con mensaje claro, sin degradar a modo silencioso.

## 9. Pruebas esperadas
- Unitarias: traducción de errores de dominio a respuestas HTTP; guardia de limpieza de la BD de pruebas.
- Integración: health check contra PostgreSQL real; ejecución de una migración de verificación arriba y abajo.

## 10. Preguntas abiertas
- ~~Nombre del paquete npm~~ resuelto: `busesuta-backend`.
- Cobertura mínima exacta (propuesta 70 %).
- Fecha en que el equipo revisa la corrección del `README.md` (tarea `docs`, desbloqueada al aceptarse los ADR).

## 11. Defecto inducido (solo si aplica)
**No aplica.** INFRA-01 no introduce defectos académicos. Cualquier defecto inducido futuro requiere spec de defecto aprobada por separado (`docs/errores-inducidos.md`).

## Precisiones de verificación
- La guardia de pruebas parsea DATABASE_URL y exige que el nombre de base termine en _test y NODE_ENV=test (no compara el URL completo, que puede contener parámetros).
- Docker de pruebas usa proyecto y volumen independientes; ningún proceso lee un .env existente. Los scripts aceptan variables exportadas por el usuario.
- Dependencias de calidad: Jest, ESLint, Prettier y eslint-config-prettier. CommonJS exige no-restricted-modules además de no-restricted-imports.
- No se aprueba un umbral de cobertura nuevo: el 70 % continúa como propuesta.
