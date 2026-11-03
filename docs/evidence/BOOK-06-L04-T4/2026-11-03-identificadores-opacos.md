# BOOK-06-L04-T4: compatibilidad de identificadores, incremento I

Estado actual: checkpoint c3e9450 más ajustes locales sin commit/publicación. Última validación: 2266 pruebas aprobadas; formato global con 17 archivos ajenos pendientes. Véase «Preparación posterior al checkpoint» para reparto y resultados actuales.

## Registro histórico previo al checkpoint

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


## Preparación posterior al checkpoint y reparto comunicado

Checkpoint comprobado c3e9450, sin publicar. Leslie aporta mensaje de Shirley: feature/PAGOS-WEB-01-bandeja, c1d638f más cambios sin commit; acepta ese reparto. Shirley implementa conexión de carga/autorización; Leslie mantiene migración de texto y compatibilidad con outbox. No se han leído cambios privados ni atribuido implementación productiva al mensaje.

GitHub consultado: #55 integrada mediante 75ee7a0 el 3 de noviembre, 21:30:58Z; #56 permanece abierta en borrador en 15218ae. Origin/develop c08ce6c no cambia ninguna de las 20 migraciones base ni su catálogo respecto de feb7f75; diff exacto aprobado. La rama continúa desde su checkpoint, sin merge/rebase. estado-proyecto conserva las filas nuevas del develop consultado además del seguimiento de Leslie; eso no equivale a integrar sus cambios de aplicación.

El planificador sin commit se preservó en stash 38fd1d801af875898e7cdb39ce6177751ae55efa, vinculado a su rama feature/BOOK-06-planificador-expiracion. No se crea una copia de trabajo ni se descartan archivos.

### Fallo reproducido y arreglo mínimo

Una prueba nueva falla antes del arreglo: se esperaba booking_id con espacios externos y se recibía el valor recortado. toPaymentProof usa createPaymentProof, y saveWithPendingNotification inserta luego ese ID reconstruido al outbox. Se valida el contenido pero se conserva el valor exacto de booking_id; IDs de comprobante/cooperativa y las migraciones ya guardadas no cambian.

Cinco comprobaciones unitarias nuevas: identidad exacta al crear/subir y cuatro entradas sin contenido rechazadas. Dos integraciones nuevas: tres identidades distintas por espacios/case conservan comprobantes/avisos separados, sin sobreescribir ni actualizar avisos ajenos; fuente/receptor persistidos recuperan la misma aceptación tras el plazo con ID externo exacto.

La prueba del receptor usa una fila persistida sintética, no un alta HTTP ni una prueba de procedencia autorizada. El constructor de altas genera UUID; no se amplía su contrato. La carga legada todavía recorta la entrada: Shirley deberá evitar esa normalización en su conexión nueva.

La primera ejecución dirigida encontró además dos problemas de fixture: los IDs opacos residuales bloquearon correctamente el down a UUID y el constructor usado para preparar la reserva recortaba su ID inyectado. Se añadieron limpiezas finally de los registros propios y una fixture persistida explícita. No se modificó el down ni se desactivaron triggers/validaciones. La segunda ejecución ya pasó las dos suites de Pagos; el down todavía encontró el residuo de la ejecución anterior. Se recreó exclusivamente el Compose temporal antes de la ejecución global final.

### Validación posterior

Node 24.21.0, PostgreSQL 16.13 en Compose leslie-ids-compat, tmpfs y puerto 55433; guard de base _test y NODE_ENV=test. Sin .env o bases persistentes. Unitarias dirigidas: 36/36 aprobadas. Catálogo de integración: aprobado en la primera dirigida. Lint aprobado; formato global conserva los 17 archivos ajenos. npm test final sobre base temporal nueva: 1729/1729 unitarias, 89/89 suites; 537/537 integraciones, 41/41 suites, 341,19 s; salida 0, 2266 pruebas aprobadas. Incluye catálogo/actualización desde 20 migraciones, down protegido y arranque real existentes. Las dos integraciones nuevas y sus limpiezas pasaron dentro de la ejecución completa.

Sin dependencias, cambios de composición, edición de migraciones existentes ni modificación del timeout de fotografías. Revisión humana, commit de ajustes y publicación pendientes. Resultados históricos anteriores se conservan con su fecha y alcance.


Comprobación final: lint aprobado; formato propio aprobado en los nueve archivos JS de la entrega; diff --check aprobado. La prueba de fotografías pasó en esta ejecución sin modificar ni repetir su timeout para ocultar fallos. Se conserva su antecedente intermitente, sin declarar una corrección ajena. Formato global aún fallido en 17 archivos previos. Logs completos de esta ejecución guardados localmente en el espacio del chat como book-ids-compat-npm-test.log; los conteos anteriores pertenecen a ejecuciones históricas y no se reemplazan.

Revisado el diff desde checkpoint y contra develop: no se editan migraciones guardadas, catálogo, rutas, servidor, caso de uso de carga o dependencias. El cambio productivo posterior a c3e9450 se limita a conservar booking_id en el modelo. Búsqueda accesible de PR por identificadores devolvió #61/#48/#47, sin otra migración de texto identificada; no certifica ausencia de trabajo privado.

[Borrador de descripción de PR](descripcion-pr-identificadores.md) listo para copiar tras guardar/publicar los ajustes. No hay PR nueva ni aprobación humana atribuida. La rama sigue en c3e9450 con cambios sin commit.


Limpieza posterior comprobada: cero bases catalog_*_test pendientes; Compose down retiró leslie-ids-compat-db-test-1 y su red exclusiva, descartando tmpfs. No se detuvieron servicios ajenos. Sin cambios a la rama guardada del planificador.


Publicación autorizada por Leslie tras revisar los resultados: guardar los ajustes en un commit atómico y publicar únicamente feature/BOOK-06-carga-autorizada. La autorización no integra la rama ni aprueba su PR; no incluye el planificador preservado aparte.
