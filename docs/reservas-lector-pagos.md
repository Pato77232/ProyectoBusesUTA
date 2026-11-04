# Lector de reservas para Pagos

Fecha: 2 de noviembre de 2026. Spec: [BOOK-07-L05-T1](specs/BOOK-07-L05-T1.md).
Estado: implementado y probado localmente en feature/BOOK-03-resumen-creacion-dominio, sin commit/PR ni integración. Revisión humana pendiente.

## API pública disponible en esta rama

```js
const bookings = createBookingsModule({ pool, auth, env });
const result = await bookings.paymentQueries.findForPayment(
  { bookingId, purpose: 'UPLOAD_PROOF' },
  {
    userId: authenticatedUser.id,
    role: authenticatedUser.role,
    cooperativeId: authenticatedUser.cooperative_id,
  },
);
```

authenticatedUser debe proceder de req.auth.user tras Auth real, no del body ni un objeto arbitrario del navegador. El ejemplo pertenece a composición/caso de uso interno; no agrega un endpoint público. El lector no verifica un token por duplicado ni acepta credenciales de un trabajador durable.

Propósitos: UPLOAD_PROOF para CUSTOMER propietario con tenant null; REVIEW_PAYMENT para CLERK de la cooperativa. Administradores, invitados y trabajadores sin contrato propio no heredan permisos. Consulta estricta, bookingId opaco no vacío, sin tenant/owner/precio del body.

## Datos y errores

DTO inmutable: bookingId, cooperativeId, status PENDING_PAYMENT, totalPriceCents, currency USD, createdAt, proofWindowStartedAt, proofWindowSeconds, expiresAt, evaluatedAt, canUploadProof. ownerId solo para carga del propietario.

El importe es el total persistido y coherente con el resumen, no precio del catálogo actual ni dinero transferido. Inicio y duración efectivos se capturan de la creación, independientemente del significado público de createdAt. Se conservan al reintentar y al cambiar configuración. Fechas ISO UTC y evaluación con reloj inyectado de servidor.

Null idéntico para reserva inexistente/ajena. Errores públicos seguros: BOOKING_VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN, BOOKING_DATA_INTEGRITY_ERROR, BOOKING_QUERY_UNAVAILABLE e INTERNAL_ERROR. Sin clases privadas de Auth/Payments ni mensajes SQL; temporalidad clasificada explícitamente.

## Persistencia y despliegue

Nueva migración: 1793740000000-booking-payment-read-context. Las migraciones anteriores no se editan.

- Nuevas reservas: inicio/duración y NOT_RECEIVED se guardan con reserva, resumen/pasajeros, ocupaciones y clave de intento en una única transacción.
- Filas previas: UNKNOWN, sin inventar inicio/duración/ausencia de recepción. El lector responde error de integridad hasta conciliación autorizada.
- RECEIVED identifica un primer vínculo/instante aceptados, inmutables una vez conocidos. Este incremento prepara restricciones y lectura; no expone operación para aceptar un comprobante.
- Inicio/duración/vencimiento conocidos protegidos frente a cambios. Down conserva negocio pero pierde metadatos; reup vuelve a UNKNOWN. Si restaurar la regla histórica implicara modificar fechas, down falla atómicamente.
- El despliegue debe aplicar la migración nueva antes de usar el código actualizado de escritura/lectura. No ejecutar migraciones en una base real sin el proceso del equipo. Una versión antigua que escriba sin metadatos no genera elegibilidad conocida por defecto.

canUploadProof solo es true con hechos válidos, PENDING_PAYMENT, ausencia conocida y evaluatedAt < expiresAt. En igualdad/después o con recepción comprobada da false. Unknown/corrupción no son false. La consulta nunca expira, libera, cambia estado o prolonga la reserva; la aceptación de recepción posterior debe revalidar por su propio contrato.

## Verificación del 2 de noviembre

Windows, Node 24.21.0, PostgreSQL 16.13 en proyecto Compose exclusivo busesuta-leslie-lector, base inicialmente sin tablas. Sin leer .env ni usar cuentas/datos reales.

| Comprobación | Resultado |
| --- | --- |
| npm run lint desde backend | Aprobado |
| npm test completo final | 839 unitarias + 206 integraciones = 1045 aprobadas, 68 suites |
| Incremento nuevo | 66 unitarias y 18 integraciones; incluidas en el total, no sumar dos veces |
| Arranque real | Aprobado en booking-http.test.js: health y rutas existentes; sin catálogo ficticio de producción |
| Sesión real de Auth | JWT/sesión persistida y revocación probados; cuerpo no decide identidad |
| Consumidor PR #47 + proveedor local + PostgreSQL | 9 comprobaciones aprobadas, código de consumidor/error leído de Git 975e2a1 y evaluado en memoria; sin copiar proyecto ni conectar rutas productivas |
| Formato explícito de los 10 JS tocados | Aprobado |
| npm run format:check global | Fallido: 24 archivos preexistentes ajenos; no se modificaron |
| Reversión, restricciones e historia | Probadas en esquemas exclusivos, retirados al terminar |

La comprobación de contrato verificó totales/fechas, minimización de ownerId al CLERK, acceso cruzado, traducciones 400/401/500 y semilla de recepción conocida. No constituye aprobación productiva ni prueba de una API de recepción inexistente.

Incidencias conservadas: primer comando dirigido de Jest se lanzó desde raíz con configuración incorrecta, repetido desde backend; primer test nuevo de composición tenía un doble authorize que no devolvía middleware, corregido manteniendo aserciones. Primera suite global falló en una prueba antigua que asumía la migración de idempotencia como última: se ajustó su preparación para revertir por nombre objetivo, manteniendo todas sus expectativas y añadiendo control de migraciones eliminadas. Repetición final completa aprobada. No se borraron pruebas ni aumentaron tiempos límite.

## Límites y siguiente integración

Falta conectar rutas/casos de uso de Payments al lector real mediante una integración autorizada. La PR #47 está en develop y esta rama no incorpora ese develop; la prueba de compatibilidad no reemplaza esa integración de ramas.

No implementados aquí: recepción/expiración transaccional y coordinador, confirmación/liberación, versiones de archivo/importe observado, caja, invitado o correo. El estado de revisión de F11 sigue pendiente. No actualizar hechos de recepción por SQL desde Payments ni interpretar una lectura true como aceptación.

La creación de reservas sigue pendiente de adaptar cotización/inventario y componer proveedores reales conforme al resto del plan. El lector puede consultar reservas persistidas sin catálogo/acreditador; esto no habilita una compra comercial completa.

Revisión de Pablo/Shirley e integración del equipo pendientes. No commits, push, merge, rebase ni tags en esta sesión.

Limpieza confirmada al terminar: contenedor y red busesuta-leslie-lector retirados; consulta posterior sin recursos de ese proyecto. Los demás servicios Docker del usuario permanecen fuera del alcance.


## Resultado de conciliación de PR #51 — 2 de noviembre de 2026

Develop 5abc36d incorporado en la rama feature de Leslie, partiendo de 67b333b, con autorización humana. Once conflictos resueltos conservando avances de ambos lados; no se fusiona la PR hacia develop. [Evidencia actual](evidence/BOOK-07-L05-T1/2026-11-02-conciliacion-pr51.md).

Backend: lint aprobado, 1572 unitarias aprobadas. Integración global: 459/462 aprobadas antes de ajustar dos pruebas de reversión; esas suites se verificaron después (programación aprobada y viajes comerciales 19/19). Persiste timeout de fotografía de Fleet, reproducido sin cambiar su código/límite. La suite global no se declara aprobada. Formato global fallido en 17 archivos ajenos; formato de resolución aprobado.

Frontend: lint, 181 pruebas, arranque Nginx y ocho grupos Chrome aprobados. Compatibilidad directa con consumidor actual Payments: nueve comprobaciones aprobadas, sin conectar rutas productivas. Entorno temporal retirado.

Bloqueo de despliegue reproducido: una base ya migrada con develop rechaza create-bookings por orden de migración; historial de 17 registros intacto. Propuesta para el siguiente incremento: acordar con Pablo una actualización no destructiva, con spec y pruebas sobre datos previos. No se editan migraciones existentes ni se desactiva globalmente checkOrder. PR #51 permanece en borrador; revisión humana y resolución de pendientes requeridas.


## Catálogo de despliegue vigente — 3 de noviembre de 2026

El bloqueo de orden descrito el 2 de noviembre se aborda en [la evidencia del catálogo](evidence/BOOK-07-L05-T1/2026-11-03-catalogo-migraciones.md) y en BOOK-07-L05-T1. Los tres originales siguen en su ruta, intactos, como fuente histórica; el catálogo activo ejecuta en su lugar 1793820000000-install-bookings, posterior a las 17 migraciones de develop contrastadas en 2df5949. La nueva entrada aplica realmente esquema, idempotencia y contexto de lectura dentro de una transacción. No registra los IDs originales como aplicados.

Antes de DDL, el migrador valida el catálogo y el historial bajo bloqueo. Conserva checkOrder:true, la exclusión de archivos ocultos y rollback que incluye el bootstrap de pgmigrations. Cada migración futura exige actualizar explícitamente el catálogo y sus pruebas. Los comandos npm run migrate/migrate:down no cambian.

MIGRATION_HISTORY_UNSUPPORTED exige detener la actualización: una base con cualquiera de los originales aplicados requiere un plan específico y revisión humana. No se consultaron bases persistentes ni se afirma que todas estén libres de esos originales. No escribir historial a mano, cambiar la URL para eludir el rechazo ni borrar datos. Los resultados actuales y límites están en la evidencia enlazada; la revisión/integración de PR #51 siguen pendientes.
