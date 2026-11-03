# BOOK-06-L04-T4: compatibilidad de identificadores, incremento I

3 de noviembre de 2026. Base origin/develop feb7f75, PR #62 integrada. Rama local feature/BOOK-06-carga-autorizada, sin commits/push ni PR. Se aplica guia-proyecto y se comprueban PR #55/#56 antes de proponer trabajo: abiertas, 7448e1a y 15218ae, lectura de revisión, sin carga autenticada disponible en esas entregas.

## Decisiones y alcance

Leslie confirma: «Sí, conservarlos y aplicar autorización nueva» para comprobantes antiguos con archivo sin procedencia acreditada. Se registra en T4 §3; no se inventa conformidad individual de Shirley/Pablo. Quién está implementando el consumidor autenticado permanece consultado, sin respuesta registrada. Este incremento independiente no toca ese consumidor ni adopta comprobantes antiguos.

La inspección encuentra una incompatibilidad real: Bookings/contrato de lectura admiten bookingId opaco, pero payment_proofs.booking_id y payment_proof_notification_outbox.booking_id son UUID. El error impide persistir comprobantes de una reserva con ID de texto. La migración original permanece intacta.

Migración nueva 1794000000000-payment-booking-identifiers: ambas columnas pasan a text mediante cast nativo, mantienen NOT NULL, unicidad e índices, y exigen contenido no vacío. cooperative_id e IDs de comprobante/outbox conservan UUID. Catálogo explícito pasa de 20 a 21, con orden, historia y exclusión exacta de originales/ocultos intactos.

Down valida primero que cada ID de ambas tablas sea un UUID en su representación canónica minúscula. Rechaza texto opaco o mayúsculas sin DDL ni pérdida de identidad; requiere plan separado. No borra ni normaliza registros para permitir reversión.

## Verificación dirigida

66/66 aprobadas en cuatro suites, 55,69 s: catálogo unitario/integración, recepción/expiración y puente real de pagos. Cinco casos nuevos:

- Actualizar desde las 20 migraciones integradas con comprobante/outbox y datos de otros módulos: filas exactas conservadas, tipos text, repetición sin efectos, down/up UUID sin cambios de datos/definiciones.
- Rechazo de down con ID opaco y, separadamente, UUID con mayúsculas; snapshot e historial intactos y rechazo de IDs vacíos.
- Fallo DDL en la segunda tabla revierte también la primera y el historial; reintento posterior aplica una entrada real.
- Puente persistido con reserva no UUID, Unicode/comilla/espacios: conserva ID en reserva/comprobante/outbox/recepción, archivo real y asientos. Contexto de comprador exclusivamente QA, como en la suite original; no Auth HTTP productivo.

Se conservan todas las aserciones anteriores. La prueba del down protegido de recepción retira primero la migración nueva, comprueba su nombre y restaura el esquema en finally. Los conteos se actualizan a 21. La comparación de definiciones conserva cada elemento y transforma explícitamente solo los dos booking_id de UUID a text; no se omiten tablas ni expectativas.

## Entorno y controles

Node 24.21.0; PostgreSQL 16.13 temporal exclusivo busesuta-leslie-ids-opacos, tmpfs/puerto 55433. Sin .env ni bases persistentes. Lint inicial aprobado; formato global conserva los 17 archivos ajenos ya documentados. npm test completo: 1724/1724 unitarias aprobadas (89 suites); integración 534/535, 40 suites aprobadas y una fallida, 332,727 s. Salida global 1. Único fallo: timeout original de 20000 ms de tests/integration/fleet/bus-photo-storage.test.js, ya reproducido aisladamente y documentado en PR #62. Archivo y código de Fleet intactos; no se repite para obtener una suite verde ni se cambia su límite. No se declara validación global aprobada.

Lint aprobado; formato propio de seis JS modificado/nuevo aprobado. Arranque real incluido entre las integraciones aprobadas. No se repite frontend porque no se modifica UI ni composición; pruebas de carga usan contexto QA explícito.

Diff completo revisado, incluido nuevo SQL y cambios de preparación de pruebas; git diff --check aprobado. Las migraciones existentes conservan su contenido. Consulta de bases catalog_*_test pendientes: cero. Contenedor/red busesuta-leslie-ids-opacos retirados y filtros por etiqueta vacíos, sin detener servicios ajenos.

No se cambia código de aplicación, Auth, fuente SQL, rutas, servidor, frontend, dependencias ni migraciones existentes. No se activa carga real ni se crea prueba de procedencia a partir de datos previos. La regla histórica confirmada se implementará con el consumidor autenticado posterior. El timeout de Fleet conserva su estado pendiente con el resultado real indicado, sin modificar prueba/límite.


## Siguiente alcance

Contrato de carga autenticada preparado en T4, regla de historia previa confirmada por Leslie; consumidor aún sin implementar. La consulta sobre trabajo concurrente de Shirley sigue sin respuesta registrada. El caso de uso legado además normaliza bookingId con trim: el nuevo consumidor debe preservar la identidad opaca exacta; este incremento solo corrige almacenamiento/fuente, y no cambia ese caso de uso.

Todo sigue local, sin staging, commit, push ni PR nueva. Checkpoint sugerido: fix(pagos): conserva identificadores de reservas como texto. La regla histórica y la activación Auth se implementarán en su incremento posterior, sin duplicar el trabajo del equipo ni atribuir aprobaciones.

Leslie autoriza posteriormente el checkpoint local al aceptar el plan de guardar este cambio y avanzar con el planificador independiente. Sin publicación ni integración; commit consultable en feature/BOOK-06-carga-autorizada.
