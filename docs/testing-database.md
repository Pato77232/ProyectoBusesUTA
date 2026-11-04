# Base de datos de integración

Las pruebas de integración requieren PostgreSQL. El guard de limpieza exige
`NODE_ENV=test` y una base cuyo nombre termine en `_test`; nunca apuntes estas
pruebas a una base de desarrollo o producción.

## Con Docker Compose en Windows

Inicia Docker Desktop y, desde la raíz del repositorio, levanta la base aislada:

```powershell
docker compose -f docker-compose.test.yml up -d --wait
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
docker compose -f docker-compose.test.yml down
```

Los datos de prueba se descartan al detener el contenedor. No agregues credenciales
reales al repositorio ni cambies el sufijo `_test`: es una protección obligatoria
antes de truncar datos.
