# BOOK-10: Venta de espacios accesibles

- **ID local:** BOOK-10; criterios de implementación elegidos por solicitud explícita del solicitante el 4 de noviembre de 2026; revisión funcional humana pendiente.
- **Módulo:** Bookings consume el inventario público de Fleet y el snapshot de Route Sheets.
- **Responsabilidad propuesta:** solicitante; revisión de reglas con Leslie y David pendiente.
- **Estado:** implementación autorizada por el solicitante usando los criterios de §3; revisión de Leslie, David y responsable funcional de RN-12 pendiente antes de integrar.
- **Base de PR integrada:** merge commit `292bb1f` de la PR #100 en `develop`; rama local de implementación creada desde el head de esa PR, ancestro del merge.

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

- **Decisión para esta implementación:** cualquier cliente autenticado puede elegir una posición accesible; no se exige beneficio de discapacidad acreditado para comprarla. Se mantienen los requisitos actuales de accesibilidad operacional y compra autenticada.
- **Motivo:** RN-12 contempla el espacio accesible, mientras que la categoría del asiento no acredita una condición personal ni habilita beneficios económicos. No se añade un flujo de oficinista.
- **Participantes:** responsable de Reservas, responsable de Route Sheets/Fleet y responsable funcional de RN-12.
- **Estado:** criterio elegido por solicitud del solicitante; revisión funcional pendiente.

### 3.2 Capacidad y acompañante

- **Resuelto por FLEET-08:** una posición `ACCESSIBLE` ocupa una celda y no aumenta la capacidad comercial del bus; el acompañante, si corresponde, ocupa un asiento normal separado.
- **Decisión para esta implementación:** el acompañante es opcional. Si se compra un asiento para acompañante, será NORMAL y se incluirá en la misma reserva transaccional como pasajero separado; el cliente también puede comprar solo la posición ACCESSIBLE.
- **Motivo:** cada espacio accesible ocupa una celda y el acompañante ocupa otra posición comercial normal; la reserva existente ya asigna todas las posiciones de una compra atómicamente.
- **Estado:** criterio elegido por solicitud del solicitante; revisión funcional pendiente.

### 3.3 Precio y snapshot comercial

- **Decisión para esta implementación:** aplicar la tarifa regular del tramo. Los descuentos se calculan solo con la verificación de beneficios existente para cada pasajero; `ACCESSIBLE` por sí sola no crea tarifa diferenciada ni descuento.
- **Contexto resuelto:** FLEET-08 prohíbe que la misma posición sea a la vez `VIP` y `ACCESSIBLE`; no corresponde proponer recargo VIP para esa posición.
- **Recomendación:** definir el precio y persistirlo en el snapshot inmutable de la compra, con categoría, identidad del asiento y tarifa/descuento aplicados. La categoría `ACCESSIBLE` por sí sola no acredita discapacidad ni concede descuento.
- **Estado:** criterio elegido por solicitud del solicitante; revisión funcional pendiente.

### 3.4 Compatibilidad del contrato

- **Contrato actual:** Fleet identifica la categoría `ACCESSIBLE` con `offered: false`; Route Sheets valida que no se ofrezca y la excluye del catálogo comercial. Bookings consume el contrato comercial `NORMAL`/`VIP`.
- **Decisión para esta implementación:** evolucionar explícitamente el snapshot comercial con una colección separada de posiciones accesibles en versión nueva del contrato. `offered` mantiene su significado actual para asientos NORMAL/VIP; los espacios ACCESSIBLE no se incluyen como asientos comerciales normales y solo serán reservables por el flujo BOOK-10.
- **Motivo:** conserva la garantía FLEET-08 (`ACCESSIBLE` no se ofrece automáticamente), evita cambiar silenciosamente contratos existentes y permite que Bookings valide categoría e identidad contra el snapshot congelado del viaje.
- **Estado:** criterio elegido por solicitud del solicitante; revisión funcional de Fleet/Route Sheets pendiente.

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

## 7. Autorización y revisión

El solicitante pidió explícitamente que el asistente seleccionara criterios coherentes con el proyecto y continuara con la implementación. Esta autorización permite preparar el cambio local con las decisiones indicadas arriba, pero no representa respuestas ni aprobación de Leslie, David o de la persona responsable funcional de RN-12. La revisión humana de esos participantes sigue pendiente antes de integrar. No se envió ningún mensaje a integrantes.
