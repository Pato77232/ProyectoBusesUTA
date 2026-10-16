# Autenticación: ejecución y verificación

## Alcance entregado

Backend de AUTH-01 a AUTH-04: registro de Cliente, login, consulta de sesión y logout de la sesión actual. No hay frontend en esta entrega. No se incluyen altas de personal, cooperativas, recuperación de contraseña ni MFA. La FK de cooperativa sigue pendiente de TENANTS-01/AUTH-FK-01; no existe endpoint para crear personal interno.

## Entorno reproducible de pruebas

Requisitos: Node 24, npm y Docker Compose. Desde la raíz del proyecto:

```bash
docker compose --env-file /dev/null -p busesuta-auth-test -f docker-compose.test.yml up -d --wait
cd backend
npm ci
export NODE_ENV=test
export DATABASE_URL=postgresql://test_user:test_only_password@127.0.0.1:55432/busesuta_test
npm run lint
npm run format:check
npm test
```

Estas credenciales son ficticias, exclusivas del contenedor de pruebas ligado a localhost. La base utiliza tmpfs y se pierde al eliminar el contenedor. Las pruebas aplican/revierten migraciones y vacían tablas únicamente tras validar NODE_ENV=test y un nombre de base terminado en `_test`. No ejecutar contra una base que deba conservarse. `npm test` falla explícitamente si no se proporciona la base de integración; no omite pruebas silenciosamente.

Para apagar el entorno desde la raíz:

```bash
docker compose --env-file /dev/null -p busesuta-auth-test -f docker-compose.test.yml down
```

## Arranque local para probar la API

Con el contenedor anterior iniciado, desde `backend/`, usando solo sus datos ficticios:

```bash
export NODE_ENV=development
export DATABASE_URL=postgresql://test_user:test_only_password@127.0.0.1:55432/busesuta_test
export JWT_SECRET="$(node -p 'require("node:crypto").randomBytes(32).toString("hex")')"
export JWT_EXPIRES_IN=30m
npm run migrate
npm start
```

El secreto se genera en la sesión de terminal; no se guarda ni se publica. El servidor escucha en el puerto 3000. Los scripts no cargan archivos `.env` automáticamente: usa variables exportadas o el soporte `node --env-file` bajo tu control. La ejecución de pruebas sobre esta misma base borra los datos ficticios de la demostración.

## Contrato HTTP

| Método y ruta | Entrada | Resultado |
|---|---|---|
| GET `/api/v1/health` | — | 200 después de consultar PostgreSQL |
| GET `/api/v1/auth/csrf` | Cookies actuales | 200 `{ "csrfToken": "..." }` y cookies de vínculo |
| POST `/api/v1/auth/register` | `{ "email": "...", "password": "..." }` + CSRF | 201 sin cuerpo; no inicia sesión |
| POST `/api/v1/auth/login` | Mismos campos + CSRF | 200 sin cuerpo y cookie `access_token` |
| GET `/api/v1/auth/me` | Cookie de acceso | 200 `{ "user": { "id", "email", "role", "cooperative_id" } }` |
| POST `/api/v1/auth/logout` | Cookie de acceso + CSRF de esa sesión | 204; revoca solo la sesión actual |

El cliente conserva las cookies y envía el valor recibido de CSRF en la cabecera `X-CSRF-Token` en cada POST. Debe obtener un nuevo token CSRF después de login o logout: está ligado a la sesión. En un cliente fetch del mismo origen las cookies se conservan automáticamente; no almacenar el JWT en localStorage. No se configura CORS entre orígenes en esta entrega.

Contraseña: 15–128 caracteres, incluyendo espacios sin recortar. Email normalizado con trim y minúsculas. El registro no acepta campos extra: no se pueden enviar rol ni cooperativa. Email duplicado responde 409 `REGISTRATION_CONFLICT`; credenciales erróneas/inexistentes responden idéntico 401 `INVALID_CREDENTIALS`. CSRF inválido: 403. Exceso de intentos: 429. Sesión inválida, vencida, revocada o cuyos permisos cambiaron: 401.

La API pública `auth/index.js` expone `authenticate`, `authorize(...roles)` y `csrfProtection` para que la composición proteja futuros módulos. Los módulos consumen solo esta API pública. Nunca confiar en `cooperative_id` aportado en un cuerpo HTTP.

## Configuración

| Variable | Valor inicial / requisito |
|---|---|
| DATABASE_URL | Obligatoria; PostgreSQL |
| JWT_SECRET | Obligatoria, al menos 32 caracteres; generar aleatoriamente |
| JWT_EXPIRES_IN | `30m`; entero positivo con unidad `s`, `m` o `h` |
| PORT | `3000`, entero de 1 a 65535 |
| LOGIN_MAX_ATTEMPTS_PER_ACCOUNT | `5` |
| LOGIN_MAX_ATTEMPTS_PER_IP | `20` |
| LOGIN_ATTEMPT_WINDOW_MINUTES | `15` |
| LOGIN_ACCOUNT_LOCK_MINUTES | `15`; también duración de bloqueo por IP |
| LOGIN_RATE_LIMIT_STORE | Solo `memory` |
| TRUST_PROXY | Solo habilitar `loopback` si el proxy está realmente en loopback |
| LOG_LEVEL | `info`; `silent` disponible para pruebas |

Los contadores son locales a una instancia y se pierden al reiniciar; no desplegar varias instancias sin sustituirlos por un almacenamiento compartido. Se cuentan verificaciones concurrentes para impedir eludir el límite. Las cookies no tienen Domain y usan Path=/, SameSite=Lax y HttpOnly cuando corresponde. En producción siempre llevan Secure, por lo que el acceso desde navegador exige HTTPS. El nonce de CSRF de producción usa `__Host-csrf_browser` para impedir inyección de esa cookie desde subdominios.

`docker-compose.yml` configura backend y PostgreSQL para un entorno separado, con variables POSTGRES_PASSWORD, DATABASE_URL y JWT_SECRET obligatorias. Requiere aplicar las migraciones mediante `docker compose run --rm backend npm run migrate` después de iniciar db. No incluye terminación TLS: desplegar detrás de HTTPS. No se debe reutilizar la clave ficticia de pruebas. Imágenes fijadas: Node 24.21.0 y PostgreSQL 16.13.

## Evidencia de validación

- 25 pruebas unitarias y 17 de integración aprobadas contra PostgreSQL 16.13.
- Pruebas originales de T2 conservadas; sin desactivar ni debilitar pruebas.
- Una prueba nueva de Argon2id se corrigió con autorización de Pablo para comparar los parámetros por nombre, conservando algoritmo, valores, sal, longitud y verificación de contraseña.
- Lint y formato aprobados. Regla CommonJS de dominio comprobada contra un import prohibido de pg.
- Docker build aprobado y recorrido health → registro → login → me probado en contenedor con datos ficticios.
- `npm audit --omit=dev`: 0 vulnerabilidades al verificar. Auditoría completa: 19 alertas moderadas transitivas en herramientas de Jest. La propuesta automática implica degradar Jest; no se aplicó. Revisar una actualización compatible de esa cadena cuando esté disponible.
- AUTH-01 a AUTH-04 no introducen errores académicos deliberados.
