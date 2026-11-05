# feat(infra): agrega diagnóstico y verifica el recorrido de ciclos

## Problema y resultado

Se necesitaba comprobar que la búsqueda usa la fecha del punto de embarque y
que preparar una renovación no habilita ventas antes de publicarla. Además,
los fallos de reversión de migraciones solo mostraban un mensaje genérico que
impedía distinguir un rechazo protector de un problema de conexión o ejecución.

Esta PR añade cobertura del recorrido de viajes/ciclos y una herramienta de
diagnóstico restringida a bases de prueba. La generación del siguiente borrador
reutiliza la renovación existente, según la decisión de repetir el patrón con
los mismos buses.

## Cambios

- Búsqueda nocturna real: salida desde Ambato el día 1 y embarque desde Salcedo
  el día 2, con fechas/horas correctas, tarifas explícitas y exclusión de
  borradores y frecuencias inactivas.
- Renovación: búsqueda y horizonte solo se amplían al publicar; publicaciones
  simultáneas no duplican viajes. Se comprueba el límite de dos períodos, la
  liberación exacta del cupo y la conservación de las filas comerciales previas.
- Contrato documentado para repetir el patrón mediante renovación: mismos buses,
  desplazamiento de L días, IDs nuevos, revalidación y publicación explícita.
- `scripts/diagnose-migrations.js`: status de solo lectura, up y down hasta un
  objetivo explícito. Informa etapa, migración/lote, duración y código seguro.
  Exige `NODE_ENV=test` y base terminada en `_test` antes de conectarse.
- Pruebas nuevas de diagnóstico, guía de uso y actualización de specs/estado.

No cambian endpoints de negocio, migraciones existentes, dependencias, timeouts
ni el CLI productivo. No se habilita rotación, scheduler o publicación automática.

## Reglas y trazabilidad

RN-02: identidad/tenant verificados en renovación; búsqueda pública de solo lectura.
RN-23: frecuencia activa para comercialización. RN-30–32 y contrato vigente:
patrón en días, continuidad, ciclos confirmados y límites sin alterar historia.
La preparación del siguiente patrón reutiliza ROUTE-SHEETS-08; no se declara
cerrado todo RN-31 ni se incorpora un algoritmo de rotación.

- [SEARCH-01: plan y secciones 1–4](../../specs/SEARCH-01.md).
- [ROUTE-SHEETS-08: verificación y decisión de generación](../../specs/ROUTE-SHEETS-08.md).
- [INFRA-05: diagnóstico seguro](../../specs/INFRA-05.md).
- [Guía de PostgreSQL aislado](../../testing-database.md).

## Cómo comprobar

Usar PostgreSQL efímero dedicado según la guía, con `DATABASE_URL` exclusiva de
pruebas y nombre terminado en `_test`. Desde `backend/`:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd test

$env:NODE_ENV = 'test'
node scripts/diagnose-migrations.js status
```

Para las suites del recorrido y diagnóstico:

```powershell
npx.cmd jest tests/integration/route-sheets/trip-queries.test.js tests/integration/route-sheets/renewals.test.js tests/integration/diagnose-migrations.test.js --runInBand
```

`down <nombre-activo>` se usa solo sobre una base desechable dedicada: revierte
pasos individualmente y se detiene al primer rechazo. No restaura automáticamente
pasos anteriores ni borra datos para eludir protecciones. Consultar INFRA-05 y la
guía antes de ejecutar una reversión.

## Validación

Ejecución final en Windows, Node 24.22.2 y PostgreSQL 16.13 efímero aislado:

- `npm run lint`: aprobado.
- `npm run format:check`: aprobado globalmente.
- `npm test`: **2029/2029 unitarias (117 suites)** y **688/688 integraciones
  (63 suites)** aprobadas.
- Recorridos dirigidos de secciones anteriores: 7/7 consultas de viajes y 14/14
  renovaciones aprobadas; también incluidos en la regresión final.
- Herramienta nueva: 12/12 unitarias y 2/2 integraciones CLI/PostgreSQL aprobadas.
- Reproducción de tres suites históricamente afectadas: 36/36 aprobadas.
- Enlaces locales comprobados; recursos de PostgreSQL temporales retirados.

Los 30 fallos de reversión registrados inicialmente no reaparecieron en esta
ejecución. No se afirma haber corregido su causa ni un timeout de Windows.
No se ampliaron límites ni se alteraron aserciones de pruebas anteriores.

## Límites y revisión

- Las pruebas de historial conservan registros comerciales; no crean ventas o
  reservas reales y no certifican todo el flujo de compra.
- Un rechazo controlado con acreditaciones persistidas prueba que el diagnóstico
  conserva datos; no demuestra la causa exacta de los 30 fallos históricos.
- No se modifica UI en esta rama de verificación ni se repite el recorrido de
  navegador en estas secciones.
- Revisión humana y verificación del diff contra develop pendientes. Las pruebas
  de IA no equivalen a aprobación ni integración.

Asistencia de IA: Codex en revisión de código, pruebas, herramienta de diagnóstico
y documentación. Decisión funcional de reutilizar renovación confirmada por el
solicitante; sin atribuir aprobaciones nuevas de otros integrantes.
