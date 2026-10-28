# BOOK-05: Calcular descuentos y resumen

- **Responsable:** Leslie
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** Política seleccionada por autorización de Leslie; T2 de cálculo puro autorizada. Integración y pantalla pendientes de tarifas reales y acreditación.
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

### Decisiones de T1 y alcance de T2
Las decisiones de producto se cierran en docs/reservas-decisiones.md por instrucción posterior de Leslie. T2 calcula una cotización individual con segmentPricesCents, birthDate y departureDate locales ISO YYYY-MM-DD y disabilityVerified booleano explícito. Consume datos confiables obtenidos por el futuro caso de uso, no constituye acreditación de declaraciones del navegador. Edad calculada en la salida; menor de 18 y mayor o igual a 65; discapacidad acreditada. Un solo descuento del 50 % si hay alguna categoría. Precio base: suma de centavos positivos seguros; redondear la mitad hacia arriba una vez por pasajero. El total y descuento deben sumar exactamente la base. Rechazar fechas imposibles, nacimiento posterior a salida, listas vacías, centavos fraccionarios, desbordamientos o acreditación no explícita. Para cumpleaños de 29 de febrero, la comparación de calendario cumple el año el 1 de marzo en año no bisiesto: decisión técnica académica registrada, no conclusión legal. No incluye cotización HTTP, acreditación real ni cobro. Rama feature/BOOK-05-T2-calcula-descuentos.

## 11. Defecto inducido
No aplica.

## Aclaración para revisión documental
Las decisiones de producto de `docs/reservas-decisiones.md` fueron seleccionadas por autorización de Leslie y cierran las preguntas correspondientes de este borrador. No se atribuye aprobación a otros integrantes. Los contratos reales pendientes están en `docs/reservas-contratos.md`; esta rama no implementa código, endpoints, tablas ni pantallas. Los avances de dominio existentes se conservan en sus ramas de tarea separadas.
## Avance
T1 de política documentada y T2 de cálculo individual implementada y probada. Pantalla, cotización HTTP, prueba con tarifas reales y acreditación siguen pendientes. Evidencia en docs/reservas-ejecucion.md.
