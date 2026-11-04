# Evidencia BOOK-05-L01 — cotización configurada

Fecha: 4 de noviembre de 2026, America/Guayaquil.

## Alcance verificado

- Se agregó cotización pura con tarifa explícita en centavos.
- Se aplican recargo VIP y el mayor beneficio elegible en basis points.
- Se conservan categorías empatadas sin acumular descuentos.
- El resumen conserva `tariffRevision` cuando recibe una política publicada.
- El flujo histórico sin proveedor tarifario conserva compatibilidad.
- El arranque real conecta `Route Sheets` para obtener viaje comercial y tarifa publicada antes de crear el resumen.
- La pantalla de Reservas mantiene selección, aceptación explícita, reintento y recuperación de intento sin guardar pasajeros como referencia.

## Verificación

- Unitarias de Reservas: 1776/1776 aprobadas.
- Integración PostgreSQL completa: 564/564 aprobadas.
- Lint, formato y `git diff --check`: aprobados para los archivos del incremento.
- Frontend Reservas: 37/37 pruebas unitarias, lint y prueba de contenedor aprobados.
- Prueba de navegador con API/PostgreSQL reales aprobada: todos los checks de
  autenticación, CSRF, teclado/foco, aceptación, cambio de tarifa, respuesta
  perdida, recuperación, sesión revocada y 503 sin inventario ficticio.
- La prueba de arranque verifica explícitamente la composición de catálogo,
  tarifario y puente de recepción hacia Payments.
- El primer incremento de `BOOK-09-L07` confirma venta contra PostgreSQL,
  convierte asignaciones a `SOLD` y repite idempotentemente la misma clave:
  2/2 pruebas de integración aprobadas.
- La integración se ejecutó con PostgreSQL temporal `busesuta_test`; el contenedor y la red fueron retirados al finalizar.
- El segundo incremento de `BOOK-09-L07` implementa rechazo justificado de comprobantes, persistencia `REJECTED`, desactivación de asignaciones reservadas y reintento idempotente.
- La verificación dirigida adicional aprobó 259/259 unitarias y 22/22 pruebas PostgreSQL de catálogo y ciclo de venta/rechazo.

## Límites

El historial autenticado y el acceso de invitado siguen pendientes en `BOOK-09-L07`; la revisión humana e integración siguen pendientes.
