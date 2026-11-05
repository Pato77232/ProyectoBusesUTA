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

- **Pregunta:** ¿cada clave `ACCESSIBLE` representa un pasajero en silla de ruedas o varias posiciones/celdas? ¿Cómo se asigna y exige el acompañante?
- **Opciones:** (A) una plaza accesible más un asiento normal opcional; (B) plaza accesible y acompañante obligatorio, vendidos como conjunto; (C) otra regla acordada por el equipo.
- **Recomendación:** no inferir capacidad a partir de una celda del layout; acordar la semántica y el bloqueo conjunto si aplica.
- **Estado:** sin respuestas humanas registradas.

### 3.3 Precio y snapshot comercial

- **Pregunta:** ¿el espacio accesible usa la tarifa regular del tramo? ¿Se permite recargo VIP? ¿Qué regla de descuento aplica tras la acreditación?
- **Recomendación:** definir precio final y persistirlo en el snapshot inmutable de la compra, incluyendo categoría, identificador/clave de asiento y regla/tarifa aplicada. No conceder descuento por la sola categoría `ACCESSIBLE`.
- **Estado:** sin respuestas humanas registradas.

### 3.4 Compatibilidad del contrato

- **Pregunta:** ¿cómo se representa la plaza vendible en el catálogo comercial sin romper consumidores que esperan solo `NORMAL`/`VIP` ni cambiar silenciosamente `offered: false` de FLEET-08?
- **Opciones:** (A) evolución compatible explícita y versionada del DTO; (B) endpoint/consulta comercial separados con versión de contrato; (C) mantener el contrato actual y bloquear la venta hasta que consumidores migren coordinadamente.
- **Recomendación:** acordar el cambio entre Fleet, Route Sheets y Bookings, con pruebas de compatibilidad y sin cambiar el significado existente de `offered` de forma implícita.
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
