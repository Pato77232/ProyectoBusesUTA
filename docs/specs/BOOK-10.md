# BOOK-10: Venta de espacios accesibles

- **ID local:** BOOK-10; borrador de contrato, sin aprobación funcional registrada.
- **Módulo:** Bookings consume el inventario público de Fleet y el snapshot de Route Sheets.
- **Responsabilidad propuesta:** solicitante; revisión de reglas con Leslie y David pendiente.
- **Estado:** diseño pendiente. Esta spec no autoriza implementar ventas.
- **Base local:** `origin/develop` `d7ea282` (4 de noviembre de 2026), incluye el commit de FLEET-10 `d7ea282`.

## 1. Objetivo

Permitir que un pasajero compre un espacio accesible identificado en el bus seleccionado, respetando RN-12 y el aislamiento multi-tenant. FLEET-08 actualmente identifica las posiciones accesibles y las deja `offered: false`; no habilita su venta.

## 2. Reglas y dependencias

- **RN-12:** el sistema debe contemplar espacios accesibles para sillas de ruedas.
- **FLEET-08:** categoría `ACCESSIBLE`, separada de `NORMAL`/`VIP`; no se ofrece automáticamente al catálogo vendible. El acompañante usa un asiento normal separado.
- La identidad de cooperativa y el viaje seleccionado provienen de fuentes autenticadas/validadas, no de una cooperativa arbitraria enviada por el cliente.
- Un espacio accesible no concede por sí solo el descuento por discapacidad. La acreditación y descuentos siguen las reglas existentes.
- Deben revisarse las APIs públicas de Fleet y Route Sheets; Bookings no importa sus capas internas.

## 3. Decisiones funcionales requeridas antes de implementar

### 3.1 Quién puede comprar

- **Pregunta:** ¿la selección está disponible para cualquier comprador y la acreditación se verifica durante la compra, o solo para un cliente con beneficio de discapacidad previamente acreditado?
- **Opciones:** (A) permitir selección a cualquier comprador y validar accesibilidad operacionalmente; (B) exigir beneficio acreditado; (C) permitir compra por oficinista bajo flujo separado.
- **Recomendación:** no restringir por beneficio económico sin una regla expresa; definir si la selección requiere una reserva/canal asistido.
- **Participantes:** responsable de Reservas, responsable de Route Sheets/Fleet y responsable funcional de RN-12.
- **Estado:** sin respuestas humanas registradas.

### 3.2 Capacidad y acompañante

- **Resuelto por FLEET-08:** una posición `ACCESSIBLE` ocupa una celda y no aumenta la capacidad comercial del bus; el acompañante, si corresponde, ocupa un asiento normal separado.
- **Pregunta pendiente:** ¿el acompañante es obligatorio y se reserva/vende como parte de la misma operación, o el pasajero puede comprar solo la posición accesible?
- **Opciones:** (A) acompañante opcional, con asiento normal reservado por separado; (B) acompañante obligatorio y ambas posiciones se bloquean/venden atómicamente; (C) otro flujo asistido acordado por el equipo.
- **Recomendación:** dejar explícito si la compra puede confirmarse sin asiento normal de acompañante y proteger ambas posiciones ante concurrencia cuando se vendan juntas.
- **Estado:** sin respuestas humanas registradas.

### 3.3 Precio y snapshot comercial

- **Pregunta:** ¿el espacio accesible usa la tarifa regular aplicable al tramo o requiere una tarifa propia? ¿Qué descuento se aplica después de una acreditación válida?
- **Contexto resuelto:** FLEET-08 prohíbe que la misma posición sea a la vez `VIP` y `ACCESSIBLE`; no corresponde proponer recargo VIP para esa posición.
- **Recomendación:** definir el precio y persistirlo en el snapshot inmutable de la compra, con categoría, identidad del asiento y tarifa/descuento aplicados. La categoría `ACCESSIBLE` por sí sola no acredita discapacidad ni concede descuento.
- **Estado:** sin respuestas humanas registradas.

### 3.4 Compatibilidad del contrato

- **Contrato actual:** Fleet identifica la categoría `ACCESSIBLE` con `offered: false`; Route Sheets valida que no se ofrezca y la excluye del catálogo comercial. Bookings consume el contrato comercial `NORMAL`/`VIP`.
- **Pregunta:** ¿cómo evolucionan Fleet y Route Sheets para que Bookings pueda ofrecer espacios accesibles sin romper a los consumidores existentes?
- **Opciones:** (A) versionar/evolucionar explícitamente el DTO comercial con consumidores coordinados; (B) crear una consulta comercial versionada separada; (C) mantener el contrato actual hasta una migración coordinada que cubra los tres módulos.
- **Recomendación:** acordar el cambio entre Fleet, Route Sheets y Bookings y probar compatibilidad; no cambiar silenciosamente el significado actual de `offered`.
- **Estado:** sin respuestas humanas registradas.

## 4. Alcance propuesto tras aprobación

- Consultar y seleccionar una plaza accesible disponible para un viaje concreto.
- Validar de nuevo la disponibilidad y el contrato comercial antes de confirmar la compra, evitando doble venta.
- Guardar la plaza y sus datos/precio en el snapshot comercial de la compra.
- Cubrir compra autenticada y sus reglas ya existentes de pago; compra de invitado, caja, emisión de QR y correo quedan fuera salvo aprobación explícita de alcance.

## 5. Criterios de aceptación propuestos

- Una plaza accesible solo puede venderse si el viaje la ofrece expresamente según el contrato aprobado.
- Una plaza ya reservada/vendida no puede asignarse a otra compra confirmada.
- El snapshot conserva categoría, plaza, tarifa y descuentos aplicados para auditoría aun si el bus o la tarifa cambian después.
- La compra no deriva el descuento por discapacidad únicamente de `ACCESSIBLE`.
- Rechazos por contrato no compatible, indisponibilidad o selección inválida producen errores explícitos y no dejan ventas parciales.
- El aislamiento por cooperativa y viaje se verifica en pruebas de integración con PostgreSQL aislado.

## 6. Pruebas necesarias después de aprobar el contrato

- Unitarias para elegibilidad, capacidad, acompañante, tarifa/snapshot y errores.
- Integración PostgreSQL aislada para disponibilidad concurrente, persistencia del snapshot, rollback e aislamiento.
- Pruebas de contrato con Fleet y Route Sheets, incluyendo un consumidor que todavía envía/espera el DTO anterior.
- Pruebas HTTP de autorización y flujo de compra.
- No se modifican pruebas existentes para hacerlas pasar ni se editan migraciones ya publicadas.

## 7. Bloqueo y siguiente paso

Compartir con Leslie, David y la persona responsable funcional las cuatro preguntas de §3 y registrar solo sus respuestas explícitas. Una vez acordadas, actualizar esta spec, aprobarla y recién entonces planificar la implementación en una tarea pequeña. No se envió ningún mensaje a integrantes.
