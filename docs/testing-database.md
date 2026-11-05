# Base de datos de integración

Las pruebas de integración requieren PostgreSQL. El guard de limpieza exige
`NODE_ENV=test` y una base cuyo nombre termine en `_test`; nunca apuntes estas
pruebas a una base de desarrollo o producción.

## Con Docker Compose en Windows

Inicia Docker Desktop y, desde la raíz del repositorio, levanta la base aislada:

```powershell
docker compose --env-file NUL -f docker-compose.test.yml up -d --wait
```

En la misma terminal, configura la URL local y ejecuta las validaciones:

```powershell
$env:DATABASE_URL = 'postgres://test_user:test_only_password@localhost:55433/busesuta_test'
Set-Location backend
npm.cmd run lint
npm.cmd test
```

`docker-compose.test.yml` usa un directorio temporal en memoria, un puerto local
distinto al de desarrollo y credenciales exclusivas para pruebas. Al terminar,
detén el contenedor:

```powershell
Set-Location ..
docker compose --env-file NUL -f docker-compose.test.yml down
```

Los datos de prueba se descartan al detener el contenedor. No agregues credenciales
reales al repositorio ni cambies el sufijo `_test`: es una protección obligatoria
antes de truncar datos.

## Diagnosticar un fallo sin exponer datos

Con PostgreSQL efímero dedicado y las variables de prueba anteriores, desde
`backend/`:

```powershell
node scripts/diagnose-migrations.js status
node scripts/diagnose-migrations.js up
```

`status` solo consulta el historial. `up` usa el migrador real y devuelve JSON con
el lote pendiente y su duración. Ambos exigen `NODE_ENV=test` y base terminada en
`_test` antes de conectarse. La herramienta no muestra la URL, SQL, mensajes del
motor, credenciales ni stack. Los nombres se validan contra el catálogo activo.

Para reproducir una reversión **solo en esa base desechable**, indica el nombre
exacto de la migración objetivo, sin extensión:

```powershell
node scripts/diagnose-migrations.js down 1794260000000-booking-benefit-reviews
```

Esto revierte cada migración posterior y luego intenta revertir el objetivo.
Cada paso conserva su transacción; un rechazo detiene la secuencia y no revierte
los pasos anteriores que ya terminaron. El último elemento de `steps` identifica
la migración fallida y su duración. Reaplica con `up` al terminar si corresponde;
no existe limpieza ni recuperación automática. El sufijo `_test` es un guard,
no demuestra que la base sea descartable: utiliza la instancia efímera dedicada.

| Resultado | Interpretación |
|---|---|
| `ok: true` | La operación terminó; no certifica la suite completa |
| `stage: validation` | Entorno, dirección u objetivo inválidos; no hubo conexión |
| `stage: connection` | Falló la conexión antes de ejecutar migraciones |
| `P0001` en down | Excepción explícita de PostgreSQL; puede ser una protección contra pérdida de datos, no demuestra timeout |
| `MIGRATION_LOCKED` | Otro migrador tiene el bloqueo; no se omite ni se reintenta |
| `57014` | PostgreSQL canceló la consulta; requiere diagnóstico, no atribuir automáticamente a Windows |
| `DIAGNOSTIC_FAILED` | Error no clasificado, sin exponer su mensaje original |

La salida del proceso es 1 ante fallo. Conserva el reporte de prueba sin añadir
datos reales y no cambies timeouts, guards o migraciones para obtener verde.
Algunos down rechazan deliberadamente bases con información protegida. Véase
[INFRA-05](specs/INFRA-05.md).
