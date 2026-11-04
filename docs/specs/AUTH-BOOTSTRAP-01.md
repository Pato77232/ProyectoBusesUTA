# AUTH-BOOTSTRAP-01: Inicializar el administrador del sistema

- **Responsable:** Pablo.
- **Estado:** Cerrada; revisión humana e integración comprobadas en la PR #52.
- **Reglas:** RN-01, RN-02, RN-03 y ADR 0004.
- **Base:** develop con autenticación y cooperativas integradas.

## Alcance aprobado
Comando local que crea una cuenta nueva SYSTEM_ADMIN con email y contraseña y cooperative_id nulo. Sin endpoint público. Si existe cualquier SYSTEM_ADMIN, no crea otro ni cambia credenciales. Si el email está ocupado por otro usuario, rechaza la operación sin convertirlo.

## Contrato
`npm run bootstrap:admin` desde backend, con DATABASE_URL configurada por el operador y migraciones previamente aplicadas. Solicita email y contraseña con entrada oculta en terminal. Para automatización acepta JSON {email,password} por entrada estándar cuando no hay terminal. Nunca pasar contraseñas por argumentos, registrarlas en logs ni guardar credenciales en el repositorio. No lee archivos .env.
Validación de email normalizado y contraseña de 15–128 caracteres conforme a ADR 0004. Hash Argon2id con los parámetros existentes. Solo mensajes de estado genéricos; no imprime credenciales, URL de conexión ni detalles SQL. Código de salida 0 al crear o si ya existe un administrador; 1 ante datos inválidos, conflicto de email o fallo operativo.

## Diseño
Caso de uso en auth y puerto de repositorio inyectado. Adaptador PostgreSQL con transacción y bloqueo de escrituras de users durante la comprobación y el alta; dos ejecuciones simultáneas no pueden crear dos administradores. El hash se calcula antes del bloqueo. Liberar conexión y cerrar pool incluso ante errores. No cambia esquema, no crea sesiones ni ejecuta migraciones automáticamente.
El comando es una herramienta de aprovisionamiento para el operador con acceso a la base; no reemplaza la autorización HTTP. Esta tarea no impone unicidad global del rol para futuros mecanismos que el equipo pudiera aprobar.

## Criterios y pruebas
- Crear exactamente un SYSTEM_ADMIN sin cooperativa y con hash válido; permite login por la API existente.
- No modificar cuentas ni sesiones al repetir el comando, incluso con otro email o contraseña.
- Rechazar email normalizado ocupado por otro rol conservando su fila.
- Validar entradas vacías, email inválido, campos extra y longitud de contraseña.
- Probar concurrencia, rollback y liberación de recursos.
- Verificar salida del CLI sin secretos y código de salida ante éxito y errores.
- Ejecutar lint, formato y suite completa contra una base aislada de pruebas.

## Fuera de alcance
Recuperación o cambio de contraseña, varios administradores, frontend, cambios en AUTH-05 y provisión de datos de negocio.

## Defectos inducidos
No aplica.

## Evidencia
- `npm run lint` y `npm run format:check`: correctos.
- `npm test`: 93 pruebas aprobadas (54 unitarias y 39 de integración), contra PostgreSQL temporal en Linux.
- Verificados hash y login, repetición sin cambios, email ocupado, ejecución concurrente de dos procesos, rollback/liberación de conexión, validación y ausencia de secretos en salidas. Entrada oculta probada mediante streams de terminal simulados; Windows no ejecutado en este entorno.
- Sin nuevas dependencias ni migraciones. Sin ejecutar el comando sobre una base real.
- Guía: `docs/administrador-inicial.md`.
- Rama independiente desde develop; no incluye AUTH-05, cuya suite se verificó por separado.

## Corrección de revisión: entrada pegada en terminal

El 25 de octubre de 2026 se reprodujo una exposición de contraseña al pegar email y contraseña juntos: readline procesaba ambas líneas antes de activar la entrada oculta. Es un defecto inesperado, no académico. El solicitante autorizó corregirlo en esta rama después de la revisión.

Alcance acotado: lectura interactiva y pruebas de regresión; sin cambiar creación de usuarios, permisos, esquema ni entrada JSON automatizada. La transición entre preguntas debe ocultar la contraseña antes de procesar la siguiente línea, incluso en un mismo bloque de entrada. Conservar exactamente los caracteres de la contraseña, permitir cancelación y no mostrarla al terminar o fallar.

Plan: agregar una prueba que falle con el pegado conjunto, corregir la transición sincrónica entre preguntas, comprobar variantes de entrada/cancelación y ejecutar lint, formato y suite completa. La implementación y su evidencia no sustituyen la revisión humana ni la integración con develop actual.

### Resultado de la corrección local — 25 de octubre de 2026

- Nueva suite `backend/tests/unit/auth/bootstrap-admin-input.test.js`: 5 pruebas de regresión, sin modificar las anteriores. Antes del cambio fallaron 3 (pegado conjunto LF/CRLF y prefijo de contraseña en el mismo bloque del email); las 2 de cancelación pasaron.
- Después del cambio pasan las 5: se conserva la contraseña completa con espacios/Unicode, se oculta incluso un prefijo recibido junto al email y se puede cancelar por EOF o Ctrl+C.
- La pregunta de contraseña y el ocultamiento se instalan dentro del callback de email, antes de que readline procese el resto del pegado. Se pausa la entrada al obtener la contraseña y se mantiene el eco oculto durante el cierre.
- `npm run lint`, `npm run format:check` y `git diff --check`: aprobados.
- `npm test`: 98 aprobadas, 59 unitarias (10 suites) y 39 de integración (6 suites). PostgreSQL 16.13 en proyecto Docker aislado `busesuta-bootstrap-fix`, sin leer .env ni usar credenciales reales; sin dependencias o migraciones nuevas.
- Comprobación adicional Linux/Node 24.21.0 con pseudoterminal (PTY) y un único pegado de ambas líneas: salida 0, credenciales conservadas y contraseña no visible. Windows y una terminal física no se probaron.
- Validación correspondiente a esta rama, basada en `b489487`; todavía falta comprobar su integración con develop actual y la revisión humana. El registro compartido pertenece a INFRA-04 aún sin integrar: esta evidencia permanece en la spec de la tarea, sin incorporar la otra rama.

El solicitante autorizó registrar la corrección mediante el commit `fix(autenticacion): oculta la contraseña al pegar credenciales`, con pie `Refs: docs/specs/AUTH-BOOTSTRAP-01.md`. Publicación, revisión humana e integración pendientes.

### Portabilidad a la base actual — 2 de noviembre de 2026

La implementación de `9b65e9f` se trasladó a un worktree separado,
`feature/AUTH-BOOTSTRAP-01-base-actual`, basado en `origin/develop` `1dcbd6d`.
Se conservaron el comando, los casos de uso y las pruebas; la API pública de Auth
y el puerto documental se conciliaron con el código ya integrado, sin merge o
rebase. No se modificaron migraciones ni dependencias.

- `npm run lint` y Prettier explícito de los nueve JavaScript del incremento
  aprobados; `npm run format:check` falló en 17 archivos preexistentes de hojas
  de ruta/migraciones, ajenos a bootstrap. Las dos pruebas copiadas del trabajo
  previo solo se formatearon después de la suite, sin cambiar sus expectativas.
- `npm test` con PostgreSQL temporal `busesuta_test`: 71 suites/1249 unitarias y
  28 suites/352 integraciones aprobadas; salida 0.
- Las 16 pruebas dirigidas de bootstrap pasaron. No se ejecutó el aprovisionamiento
  sobre una base operativa. El commit `be75524` se publicó en
  `feature/AUTH-BOOTSTRAP-01-base-actual` y abrió la
  [PR #52](https://github.com/Pato77232/ProyectoBusesUTA/pull/52) contra `develop`.
  GitHub muestra a Shirley (`shirley6126`) como revisora solicitada. Revisión
  humana, pruebas tras combinar con la base vigente e integración pendientes.

### Conciliación de la PR #52 con `develop` — 2 de noviembre de 2026

- Base remota comprobada: `origin/develop` `f5b9bde`. El contrato de puertos
  conserva AUTH-BOOTSTRAP-01 y AUTH-06; el seguimiento conserva la PR #52 y
  la PR #53. La composición de Auth combina ambos cambios sin edición adicional.
- `git merge-tree` no muestra marcadores de conflicto. La combinación temporal
  se materializó en el árbol `da1b00d` sin integrar ninguna rama.
- Sobre ese árbol: `npm run lint` aprobado; `npm test` con PostgreSQL 16.13
  aislado aprobó 1315 unitarias y 385 integraciones (1700 en total).
  `npm run format:check` sigue fallando en 17 archivos previos ajenos a bootstrap.
- La base temporal se retiró. Pruebas ejecutadas con Node local 22; repetirlas
  bajo Node 24 sigue pendiente. La revisión humana e integración siguen pendientes.

## Revisión, integración y cierre — 3 de noviembre de 2026

Shirley aprobó la cabeza final `63fb65a` de la
[PR #52](https://github.com/Pato77232/ProyectoBusesUTA/pull/52). La PR se integró
en `develop` mediante `2df5949` a la 01:00 (America/Guayaquil). La conciliación
previa de esa cabeza aprobó lint y 1315 pruebas unitarias más 385 de integración;
el formato global conservó 17 archivos ajenos pendientes y no se ocultó ese límite.

La regresión completa posterior registrada al integrar la PR #65 aprobó 1772
pruebas unitarias y 564 de integración sobre la base que ya contiene bootstrap.
No se ejecutó el comando contra una base operativa ni se guardaron credenciales.
La repetición específica de la conciliación bajo Node 24 no quedó registrada;
se conserva como límite histórico, no como autorización para debilitar la suite.
Con revisión humana, integración y regresión posterior comprobadas,
AUTH-BOOTSTRAP-01 queda Cerrada.
