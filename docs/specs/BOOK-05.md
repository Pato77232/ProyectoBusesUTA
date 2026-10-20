# BOOK-05: Calcular descuentos y resumen

- **Responsable:** Leslie
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** Borrador; bloqueada por reglas de descuentos sin definir.
- **Dependencias:** BOOK-04, tarifas de viajes y acuerdos RN-43.

## 1. Objetivo
Presentar el precio y descuento verificables de cada pasajero antes de confirmar la reserva.

## 2. Reglas
RN-43: beneficios automáticos por tercera edad, minoría de edad y discapacidad. FREQ-01 define precios por tramo, pero aún falta su vinculación con el viaje comercializado.

## 3. Tareas
T1 documentar política aprobada; T2 servicio de cálculo; T3 desglose en resumen. No inventar porcentajes ni usar cero como sustituto silencioso de una política pendiente.

## 4. Flujo
Consultar tarifas oficiales del servidor; verificar acreditaciones acordadas; sumar tramo, aplicar política y redondeo aprobados; devolver desglose para aceptación. BOOK-03 revalida al confirmar.

## 5. Datos
Importes calculados en unidades menores o decimal exacto. Definir moneda, precisión, redondeo, combinación de beneficios, fuente de fecha de nacimiento y acreditación. El cliente no fija descuentos ni total.

## 6. Endpoints
Contrato de cotización pendiente de política y privacidad; ningún endpoint en este borrador.

## 7. Criterios de aceptación
- [ ] Cada categoría aplica el porcentaje aprobado en sus límites de edad.
- [ ] Se resuelven beneficios simultáneos y redondeo según política escrita.
- [ ] El desglose suma exactamente el total.
- [ ] La alteración del monto en el navegador no cambia el cobro.

## 8. Casos borde
Cumpleaños, acreditación ausente, múltiples categorías, importe mínimo, precio cambiado y compra parcial entre paradas.

## 9. Pruebas
Tabla de casos con importes esperados aprobados; pruebas unitarias de límites y redondeo; integración con tarifas y reserva; resumen visual.

## 10. Preguntas abiertas
Porcentajes, edades, acreditación, acumulación, moneda y redondeo. Resolver antes de T2.

## 11. Defecto inducido
No aplica.
