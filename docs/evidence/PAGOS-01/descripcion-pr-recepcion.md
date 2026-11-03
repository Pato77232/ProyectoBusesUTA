## Resumen

Agrega el puente interno de Payments con la recepción publicada por Reservas
en PR #60. Una respuesta incierta no puede convertirse en aceptación ni activar
el borrado del comprobante. Solo el rechazo de plazo confirmado y vinculado
permite la compensación existente.

## Cambios

- Consulta pública interna del comprobante y outbox persistidos: DTO mínimo,
  sin archivo, ruta física ni credenciales. Ausencia y fallo técnico distintos.
- Adaptador del receptor real: verifica outcome, tres identificadores y fecha.
  Solo ACCEPTED resuelve; REJECTED_EXPIRED válido produce error de plazo.
  Excepciones del proveedor o resultados incoherentes conservan incertidumbre.
- Composición explícita `createPaymentReceiptModule`, sin fallback simulado.
- Pruebas nuevas contra PostgreSQL y ambos módulos reales: aceptación,
  compensación, replay tardío, respuesta perdida tras COMMIT y fuente incoherente.

## Alcance y dependencias

Base develop `b4fe717`, con PR #60 integrada. No depende de integrar #55/#56
ni incluye la validación de formatos que permanece en su rama separada.
No cambia server.js, rutas, Auth, Bookings, migraciones, dependencias ni pruebas
existentes. Pendiente conectar la carga inicial a UPLOAD_PROOF con Auth real
antes de habilitar el puente en producción; no afirmar compra completa.
Venta, rechazo justificado y planificador quedan fuera de este incremento.

## Validación y revisión

37 pruebas nuevas dirigidas aprobadas; `npm test` completo: 1686 unitarias y
525 integraciones aprobadas (2211 en total). Lint, formato propio y arranque real
aprobados; formato global conserva 17 archivos ajenos pendientes. Resultados en
`docs/evidence/PAGOS-01/2026-11-03-puente-recepcion.md`.
RN-02, RN-50 y RN-51; contrato BOOK-06-L04-T2 §11–12.
Revisores propuestos: Pablo para autorización/composición y Leslie para el
contrato de recepción. Revisión humana pendiente; asistencia de Codex.

Refs: docs/specs/PAGOS-01.md §16.
