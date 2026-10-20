# BOOK-02: Consultar disponibilidad de asientos

- **Responsable:** Leslie
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** T1 autorizada por Leslie como implementación de reglas existentes; T2–T4 pendientes de contratos de flota y viajes.
- **Dependencias:** BOOK-01, RN-02, RN-12 y RN-40.

## 1. Objetivo
Mostrar qué asientos del viaje se pueden seleccionar para un tramo.

## 2. Reglas de negocio
Un asiento reservado o vendido bloquea el tramo ocupado. Las compras entre paradas requieren detectar solapamiento, sin bloquear un tramo adyacente que no comparte recorrido. Seleccionar no reserva.

## 3. Alcance y tareas
- T1: función pura de dominio para disponibilidad con inventario y ocupaciones suministrados por el servidor. Incluye errores y pruebas. Rama feature/BOOK-02-T1-disponibilidad-dominio.
- T2: caso de uso con puertos de catálogo de viaje y ocupaciones efectivas; adaptadores reales cuando existan.
- T3: consulta HTTP validada y de solo lectura; sin exponer identidades ni comprobantes.
- T4: pantalla accesible de asientos y selección local.
No incluye bloquear, cobrar ni liberar reservas. La disponibilidad consultada no garantiza la reserva posterior.

## 4. Flujo
Validar viaje/tramo, obtener inventario de ese viaje, obtener ocupaciones efectivas, calcular estado por asiento y devolver solo la información pública.

## 5. Datos de T1
Decisión técnica interna, no contrato con otros módulos: consulta con tripId, cooperativeId, fromPosition y toPosition; inventario de seatIds; ocupaciones con las mismas identidades, seatId, tramo y status RESERVED o SOLD. Los índices son enteros seguros no negativos, con origen menor que destino. Los identificadores internos son cadenas no vacías, sin imponer UUID a módulos ajenos.

Intervalos semiabiertos [origen, destino): se solapan cuando a.inicio < b.fin y b.inicio < a.fin. La función considera exclusivamente viaje y cooperativa consultados, rechaza ocupaciones inválidas y devuelve una lista inmutable de {seatId, status}, con AVAILABLE, RESERVED o SOLD. SOLD predomina si la fuente contiene ambas ocupaciones; la escritura deberá impedir ese estado inconsistente.

El adaptador futuro garantiza inventario real y ocupaciones efectivas, incluidas las que esperan revisión de pago. T1 no decide expiración ni admite datos del navegador como inventario confiable.

## 6. Endpoints
Ninguno en T1. Propuesta para T3: GET /api/v1/trips/:tripId/seats con tramo; contrato final condicionado al módulo de viajes. No montar una ruta con datos ficticios.

## 7. Criterios de aceptación
- [ ] Sin ocupaciones, todos los asientos están disponibles.
- [ ] Reserva y venta superpuestas bloquean el asiento correspondiente.
- [ ] Tramos adyacentes, otros viajes y otras cooperativas no bloquean.
- [ ] Consulta inválida, asientos repetidos o estado desconocido producen error explícito.
- [ ] La consulta no modifica entradas ni devuelve datos personales.

## 8. Casos borde
Solapamiento parcial, completo y contenido; ruta inversa, índices no enteros y viaje diferente. El listado vacío es válido para la función pura; el catálogo futuro decide si el viaje es válido.

## 9. Pruebas
Unitarias de cada caso de §7/8. Integración y pantalla pendientes de T2–T4. La concurrencia se verifica en BOOK-03, no mediante la consulta.

## 10. Preguntas abiertas
Contrato definitivo de viaje, plantilla, acceso público y comercialización por tramo. T1 no sustituye esos acuerdos.

## 11. Defecto inducido
No aplica.

## Avance
T1 implementada y probada; evidencia en docs/reservas-ejecucion.md. T2–T4 continúan pendientes. No es todavía una consulta de producción.
