# Preparación de PR: identificadores de reserva en Pagos

Estado: borrador local para revisión; no es una PR publicada ni una aprobación.

Título propuesto: `fix(pagos): conserva identificadores opacos en comprobantes y avisos`

Base: develop. Rama: feature/BOOK-06-carga-autorizada. Checkpoint de migración c3e9450 más corrección de identidad exacta en el outbox; entrega autorizada por Leslie para commit/publicación.

## Problema y resultado

Bookings entrega identificadores de reserva de texto opaco, pero comprobantes y outbox exigían UUID. La migración nueva convierte ambas columnas a text conservando los UUID previos. Además, el modelo conserva booking_id exactamente al leer/guardar: recortarlo podía producir un ID distinto en el aviso.

## Cambios

- Nueva migración 1794000000000-payment-booking-identifiers y entrada 21 del catálogo explícito; sin editar las migraciones anteriores.
- Reversión a UUID solo cuando todos los IDs son canónicos en minúsculas. IDs opacos/no canónicos se rechazan sin cambios ni pérdida de identidad.
- Validación de contenido sin normalizar booking_id. Identificadores de comprobante y cooperativa conservan su comportamiento/tipos.
- Pruebas de conservación de filas, historial, rollback de la segunda tabla, ID opaco con caracteres especiales y separación por espacios/case; recuperación de la misma recepción después del plazo.

## Verificación

PostgreSQL 16.13 aislado, Node 24.21.0. Sin .env ni bases persistentes. Lint y formato propio aprobados. npm test global final: 1729/1729 unitarias y 537/537 integraciones, 2266 pruebas aprobadas, 130 suites, salida 0. Incluye arranque real y conservación/reversión/rollback de migraciones. Fotografías pasó sin modificar código ni timeout; su antecedente intermitente se conserva en la evidencia. Formato global conserva 17 archivos ajenos sin modificaciones.

## Reparto y límites

Shirley conecta UPLOAD_PROOF, contexto verificado de Auth, receptor y registro de autorización de carga en su trabajo propio. Esta entrega prepara identificadores/persistencia; no modifica la carga legada ni activa su composición. Esa carga todavía recorta su entrada, lo que debe evitar el consumidor nuevo.

Conservar comprobantes antiguos con archivo sin procesarlos/borrarlos automáticamente. La migración no acredita procedencia ni realiza ese procesamiento. Las fixtures nuevas no certifican Auth HTTP ni lectura de archivos físicos.

Origin/develop comprobado c08ce6c: sus 20 migraciones/catálogo son idénticos a feb7f75. La rama conserva su base anterior; no se ejecutó merge/rebase ni se declara probada una combinación de aplicación que no se incorporó. El registro conserva la evidencia vigente de develop. El planificador permanece en su rama/stash independiente y no forma parte de la PR.

Revisión humana propuesta: Pablo sobre migración/historial y Shirley sobre identidad/contrato consumidor. Sin aprobación atribuida ni CI remoto comprobado. Trabajo asistido por Codex.

Refs: docs/specs/BOOK-06-L04-T4.md, incremento I y §10.
Evidencia: docs/evidence/BOOK-06-L04-T4/2026-11-03-identificadores-opacos.md.
