## Cambios

Coordina la recepción inicial de comprobantes y la expiración de reservas en una transacción PostgreSQL. Una recepción aceptada conserva sus asientos; una reserva vencida sin recepción conocida libera todas sus ocupaciones RESERVED de forma atómica. Protege SOLD e historia UNKNOWN.

Persiste ACCEPTED/REJECTED_EXPIRED por comprobante y vínculos, recuperables ante reintentos o respuesta perdida sin duplicar cambios ni renovar plazos. Nueva migración y catálogo validado; lector y adaptador preparado compatibles con EXPIRED sin permitir carga.

Base: develop 5a40702, con PR #51 integrada. El diff corresponde solo a BOOK-06-L04-T2, incremento B. Fuente externa obligatoria por composición; las pruebas usan una fuente QA persistida identificada expresamente.

## Verificación

- Backend lint aprobado; npm test completo: 1658 unitarias + 515 integraciones = 2173 aprobadas, incluido arranque real.
- Catálogo ampliado posterior: 14/14 dirigido, incluida conservación de reservas/plazos/asientos al actualizar desde develop con datos.
- Carreras reales, límites temporales, duplicados, respuesta perdida tras COMMIT y rollback completo comprobados en PostgreSQL aislado.
- Frontend lint y 205 pruebas, Nginx y ocho grupos Chrome aprobados.
- Formato propio aprobado; formato global conserva 17 archivos ajenos pendientes. Fotografías aprobadas sin ampliar timeout.
- Sin .env, bases persistentes, dependencias nuevas ni edición de migraciones existentes. Recursos QA retirados.

## Límites y revisión

Pendientes separados: conexión productiva con Payments (fuente real, autorización inicial y compensación segura) y planificador periódico. No incluye venta, rechazo, correcciones, caja o invitado. No presenta compra comercial completa.

Refs: docs/specs/BOOK-06-L04-T2.md; RN-40, RN-50 y RN-51. Evidencia: docs/evidence/BOOK-06-L04-T2/2026-11-03-actualizacion-develop.md. Apoyo de Codex; revisión humana independiente pendiente.
