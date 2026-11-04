# Preparación de PR: expiración automática de reservas

Estado: descripción preparada para commit/publicación y PR autorizados por Leslie; revisión humana pendiente.

Título propuesto: `feat(reservas): programa la expiración de reservas vencidas`

Base: develop. Rama: feature/BOOK-06-planificador-expiracion, desde 4bb6861 con PR #64 y FLEET-09 integradas (catálogo 22).

## Resultado

Recupera reservas vencidas al iniciar el servidor y las procesa periódicamente en lotes, reutilizando la expiración transaccional e idempotente de Bookings. Una recepción aceptada a tiempo conserva sus asientos; no se supone ausencia de recepción para filas históricas UNKNOWN ni se libera SOLD.

- Configuración de habilitación, intervalo y tamaño de lote, con validación antes de escuchar HTTP.
- Primer ciclo inmediato, ciclos sin solapamiento y cursor por pase para que una fila fallida no bloquee las posteriores.
- Errores de consulta propagados/reintentados sin convertirlos en lista vacía. Logs con código/fase, sin SQL o datos personales.
- Cierre que cancela futuras llamadas y drena el trabajo activo antes de cerrar el pool.
- Sin nuevas migraciones, dependencias o endpoints públicos de mantenimiento.

## Verificación

Base verificada 4bb6861, PostgreSQL 16.13 aislado, Node 24.21.0 y catálogo de 22 migraciones. npm test completo: 1772/1772 unitarias y 564/564 integraciones, 2336 pruebas en 135 suites aprobadas, salida 0. Incluye arranque/cierre real, recuperación de pendientes y carreras con recepción mediante barreras PostgreSQL.

Lint y formato propio (11 JS) aprobados. El formato global mantiene 17 archivos ajenos pendientes. Fotografías pasó sin cambios a código o timeout; la evidencia conserva el antecedente intermitente. Sin .env, bases persistentes, migraciones/dependencias nuevas ni pruebas debilitadas. CI remoto y revisión humana pendientes.

## Límites y revisión

No aplica consecuencias nuevas a los 15 minutos de corrección. El cierre espera el lote activo y puede esperar un bloqueo externo; no cancela una transacción a mitad. La recuperación al reiniciar consulta la cola persistida desde lo más antiguo.

La conexión de carga autorizada corresponde a Shirley; confirmación de venta, rechazo/liberación, acreditación y pantallas conservan sus incrementos propios. No se declara Reservas completo ni se sustituye la revisión humana con pruebas de IA.

Trabajo asistido por Codex. Revisión humana propuesta sobre coordinación y ciclo de vida; sin aprobación atribuida.

Refs: docs/specs/BOOK-06-L04-T5.md.
Evidencia: docs/evidence/BOOK-06-L04-T5/2026-11-03-planificador.md.
