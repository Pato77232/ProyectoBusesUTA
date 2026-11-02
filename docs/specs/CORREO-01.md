# CORREO-01: Contrato compartido de avisos de corrección y boletos

- **ID local:** CORREO-01; sin ticket externo.
- **Responsable de preparación:** Pablo. **Revisora:** Shirley, solicitó recibir spec.
- **Estado:** Borrador técnico; diseño base aceptado por Shirley, no implementado.
- **Base/fecha:** origin/develop 8fdf7e4; 2 de noviembre de 2026.
- **Referencias:** [acuerdos](../dependencias-pagos.md), [reglas](../business-rules.md),
  [arquitectura](../architecture.md), [calidad](../calidad.md).

## Objetivo y alcance aceptado

Distinguir registro del aviso, aceptación del proveedor, entrega confirmada y
fallos temporales/definitivos; identificar avisos y evitar duplicados. Un fallo
de correo no repite cobros, no deshace ventas ni libera asientos vendidos.
Cubre contrato para corrección de comprobante y entrega de boleto. No implementa
proveedor, worker, cola, webhook, recuperación de contraseña ni correo de invitado.

## Contrato candidato; nombres y campos pendientes de revisión

El consumidor define un puerto pequeño de solicitud de aviso. Entrada interna
propuesta: notificationId, purpose (corrección/boleto), referencia de compra,
versión del evento, destinatarios autorizados, template/version y datos mínimos.
Una clave idempotente estable identifica propósito/evento/destinatario; reintentar
la misma solicitud no crea avisos nuevos. Misma clave con contenido distinto
produce conflicto explícito, no sustituye destinatarios silenciosamente.
No aceptar remitente/destinatarios arbitrarios desde el navegador ni credenciales.
Tickets aporta referencia privada del boleto; no una URL pública permanente.
El dueño del evento obtiene destinatarios por API autorizada, no por tablas ajenas.

Salida candidata: notificationId, estado y referencia del proveedor cuando exista.
Registrar en almacenamiento durable antes de responder como pendiente; si falla
ese registro, devolver error y conservar la misma clave para reintentar. No afirmar
aceptación por el proveedor por haber encolado localmente. Tipo de retorno,
persistencia/transacción y límite de datos pendientes; no hay endpoint HTTP aprobado.

| Estado semántico aceptado | Evidencia necesaria |
|---|---|
| Pendiente | Solicitud registrada; aún sin aceptación acreditada del proveedor |
| Aceptado por proveedor | Respuesta verificable con referencia del proveedor; no prueba llegada |
| Entrega confirmada | Evento verificable que acredita entrega según contrato del proveedor; no lectura humana |
| Fallo temporal | Motivo clasificado como recuperable; reintento según política acordada |
| Fallo definitivo | Motivo no recuperable o agotamiento de política; intervención/acción definida |

Si el proveedor no ofrece confirmación, conservar aceptación sin inventar entrega.
Confirmaciones deben autenticarse, correlacionarse y deduplicarse; eventos tardíos
no pueden hacer retroceder un resultado terminal sin una regla acordada.
Timeout tras enviar es resultado incierto: conciliar por clave/referencia si el
proveedor lo permite antes de reenviar. No prometer exactamente una entrega
externa si el proveedor no soporta idempotencia o consulta de estado.

## Decisiones necesarias antes de implementar

Pablo y Shirley: proveedor y disponibilidad de confirmaciones; esquema exacto de
entrada/salida; autenticación y traducción de errores; número máximo de intentos,
intervalos/backoff, caducidad y acción al agotar; fuente de reloj; retención y logs.
Propuesta: adaptador sustituible tras puerto del consumidor y procesamiento
reintentable durable. Ubicación técnica y límites de transacción requieren acuerdo;
no crear un módulo nuevo ni dependencias arquitectónicas por esta spec.
Leslie/Shirley: cuándo nace el aviso y cómo se relaciona con vencimiento de
corrección. Un correo fallido no decide ni reinicia el plazo de la reserva.
Revisar privacidad de destinatarios por pasajero y acceso autorizado al boleto.
No configurar ni contratar proveedor hasta resolver estas preguntas.

## Criterios y pruebas previstas

- [ ] Registro local no anuncia entrega; aceptación tampoco anuncia lectura.
- [ ] Repetición/eventos duplicados no duplican aviso ni cobro/venta.
- [ ] Fallos, timeout incierto y confirmación falsa se clasifican sin filtrar secretos.
- [ ] Confirmaciones fuera de orden conservan estado según transición acordada.
- [ ] Sin confirmaciones disponibles, estado permanece honesto.
- [ ] Boleto sigue descargable mediante acceso autorizado aunque falle correo.

Unitarias de estados/puertos e integración del adaptador elegido, primero con
servidor QA; no enviar mensajes reales en pruebas automáticas. Verificar almacenamiento
y reinicio una vez acordados. SOLID: consumidores sin SDK concreto; adaptadores
cumplen el mismo contrato. Sin pantalla; etiquetas claras y siguiente acción serán
criterios para la futura UI, no usabilidad ya comprobada.

Plan: revisar esta spec → cerrar decisiones → separar registro/reintentos y
adaptador/confirmaciones en incrementos revisables antes de codificar.
Sin defectos inducidos, código, dependencias o pruebas nuevas. Evidencia actual:
aceptación base reportada por Pablo y revisión documental. Asistencia de Codex.
