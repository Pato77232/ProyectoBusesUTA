# BOOK-06: Plazo y vencimiento de reservas

- **Responsable:** Leslie
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** T1 autorizada para política pura RN-50/51; integración pendiente.
- **Dependencias:** BOOK-01; BOOK-03 y Shirley para T2/T3.

## 1. Objetivo
Liberar reservas cuyo plazo para subir comprobante venció sin comprobante.

## 2. Reglas
RN-50 exige configuración entre 3 y 5 minutos. RN-51 exige ausencia de comprobante para expirar. Un comprobante en revisión no equivale a ausencia.

## 3. Tareas
T1 política pura de plazo con reloj explícito; T2 operación transaccional de expiración; T3 ejecución periódica y aviso de tiempo. Rama inicial feature/BOOK-06-T1-plazo-reserva.

## 4. Flujo
T1 valida plazo en segundos entre 180 y 300, recibe instante de inicio decidido por el caso de uso y calcula expiresAt. Decide vencimiento comparando ahora >= expiresAt y comprobante ausente. Sin valor por defecto oculto.

## 5. Datos
Funciones internas reciben Date válido, segundos enteros y hasPaymentProof booleano explícito. Devuelven Date nuevo o booleano; no mutan entradas ni leen process.env desde domain. Aplican solo a una reserva pendiente elegible, condición que T2 deberá comprobar en base de datos.

## 6. Endpoints
Ninguno en T1. Expirar no requiere endpoint público ni confía en el reloj del navegador. El temporizador visual solo informa.

## 7. Criterios de aceptación
- [ ] Plazos 180 y 300 se aceptan; valores fuera de rango o no enteros se rechazan.
- [ ] Antes del límite no vence; en el límite sin comprobante vence.
- [ ] Con comprobante no se expira por esta regla.
- [ ] Un dato ausente no se interpreta como ausencia de comprobante.
- [ ] T2 libera de forma atómica e idempotente y no toca reservas vendidas.

## 8. Casos borde
Reloj inválido, Date fuera de rango, plazo ausente y comprobante concurrente. No decidir aquí si un comprobante tardío se admite ni cuánto dura su revisión.

## 9. Pruebas
Unitarias de T1 con fechas fijas. T2: carreras reales contra carga/aprobación, doble ejecución y liberación en PostgreSQL. T3: ejecución automática y visualización sin extender el plazo.

## 10. Preguntas abiertas
Instante exacto de inicio según método; protocolo atómico con comprobantes; tratamiento de carga tardía, rechazo y revisión. El caso de uso no se implementa antes del acuerdo.

## 11. Defecto inducido
No aplica.

## Aclaración para revisión documental
Las decisiones de producto de `docs/reservas-decisiones.md` fueron seleccionadas por autorización de Leslie y cierran las preguntas correspondientes de este borrador. No se atribuye aprobación a otros integrantes. Los contratos reales pendientes están en `docs/reservas-contratos.md`; esta rama no implementa código, endpoints, tablas ni pantallas. Los avances de dominio existentes se conservan en sus ramas de tarea separadas.
