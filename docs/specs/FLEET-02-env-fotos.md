# FLEET-02-env-fotos: Fleet respeta el env recibido al arrancar

- **ID local:** FLEET-02-env-fotos (identificador local derivado de FLEET-02, no ticket externo).
- **Estado:** Aprobada por el humano el 31 de octubre de 2026; cambio aplicado y verificado.
- **Fecha:** 31 de octubre de 2026, America/Guayaquil.
- **Base:** `origin/develop` en `4f34748`, rama `feature/FLEET-02-env-fotos`.
- **Relacionada:** [FLEET-02: Registrar un bus](FLEET-02.md).

## 1. Problema

El merge de FLEET-02 (PR #27) dejó `createFleetModule({ pool, auth })` en `backend/src/server.js`; el commit previo `d0ef74e` pasaba también `env`. `start(env)` puede recibir un env propio, pero sin esa propiedad `createFleetModule` usa su valor por defecto `process.env`. Por eso ignora el `BUS_PHOTO_STORAGE_DIR` recibido y toma el de `process.env` o, fuera de producción, `.busesuta/fleet-photos` en la carpeta del usuario.

`tests/integration/fleet/bus.http.test.js` llama `start` con un directorio temporal, así que probablemente falle o escriba fuera de él. Aún no se ha confirmado ejecutando la suite.

## 2. Cambio propuesto

En `backend/src/server.js`:

```js
const fleet = createFleetModule({ pool, auth, env });
```

## 3. Fuera de alcance

- Modificar pruebas, migraciones, dependencias u otros módulos.
- Cambiar `createFleetModule`, su valor por defecto o el almacenamiento de fotos.
- Leer `.env`.
- Commit o push sin petición humana.

## 4. Criterios de aceptación

1. `start(env)` entrega a Fleet el `env` recibido y las fotos se escriben bajo su `BUS_PHOTO_STORAGE_DIR`.
2. La guarda de producción de Fleet evalúa ese mismo `env`.
3. `tests/integration/fleet/bus.http.test.js` pasa; esa prueba usa el arranque real mediante `start`.

## 5. Verificación

Con PostgreSQL aislado según `docs/testing-database.md`, desde `backend/`:

1. Ejecutar `tests/integration/fleet/bus.http.test.js` antes del cambio para confirmar o descartar el fallo.
2. Aplicar el cambio.
3. Ejecutar `npm run lint`, `npm run format:check` y `npm test`, y registrar aquí los resultados reales.

## 6. Evidencia

PostgreSQL aislado con `docker-compose.test.yml`, base `4f34748`, Windows, 31 de octubre de 2026.

| Comprobación | Resultado |
|---|---|
| `bus.http.test.js` antes del cambio | Falla: 6 de 29 (`ENOENT` sobre `.staging` y `buses` del directorio temporal) |
| `bus.http.test.js` después del cambio | Pasa: 29 de 29 |
| `npm run lint` | Pasa |
| `npm test` | Pasa: 767 unitarias (51 suites) y 220 de integración (19 suites) |
| `npm run format:check` | Falla: 24 archivos, ninguno es `server.js`. Son `route-sheets` (21), `fleet/interfaces/bus-group-router.js` y dos migraciones; preexistente y fuera de alcance |
