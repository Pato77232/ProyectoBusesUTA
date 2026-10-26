# BOOK-06: Plazo y vencimiento de reservas

- **Responsable:** Leslie
- **Revisor propuesto por Leslie:** PabloToapanta; revisión conjunta del contrato con Shirley pendiente.
- **Módulo:** bookings
- **Estado:** Contrato de recepción/expiración documentado; persistencia, coordinación y pruebas reales pendientes. La política pura T1 pertenece al PR #15, todavía sin integrar en esta base.
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
El inicio para depósito/transferencia consta en reservas-decisiones.md. El comportamiento coordinado de recepción/expiración está documentado en reservas-contratos.md; quedan firmas, esquema, autorización y recuperación de avisos pendientes de revisión conjunta antes de implementar.

## 11. Defecto inducido
No aplica.

## Aclaración para revisión documental
Las decisiones de producto de `docs/reservas-decisiones.md` fueron seleccionadas por autorización de Leslie y cierran las preguntas correspondientes de este borrador. No se atribuye aprobación a otros integrantes. Los contratos reales pendientes están en `docs/reservas-contratos.md`; esta rama no implementa código, endpoints, tablas ni pantallas. Los avances de dominio existentes se conservan en sus ramas de tarea separadas.

## 12. Coordinación con pagos — actualización del 26 de octubre de 2026
Fuente vigente para T2/T3: [recepción frente a expiración](../reservas-contratos.md#coordinación-de-reservas-y-comprobantes--26-de-octubre-de-2026). El párrafo de revisión documental anterior corresponde a la entrega histórica; esta actualización documenta comportamiento y pruebas futuras, no una operación disponible.

- Recepción y expiración se serializan por reserva; estado, decisión de recepción y ocupaciones se confirman de forma coherente y durable.
- Una recepción nueva solo se acepta antes del límite, con hora del servidor tomada después de obtener la coordinación. En el límite se rechaza; guardar el archivo no extiende el plazo.
- Si ya se aceptó la misma operación, un reintento autorizado devuelve esa aceptación aunque llegue después del plazo. Timeout no permite borrar el comprobante.
- El coordinador solo expira pendientes sin recepción aceptada, libera de forma atómica e idempotente y respeta revisiones y ventas.
- Queda un único coordinador en bookings. Payments mantiene avisos persistentes y procesa resultados; no programa un mecanismo competidor de expiración.

### Aceptación adicional, pendiente de pruebas ejecutables
- [ ] Probar ambas carreras en PostgreSQL, con conexiones independientes y sincronización controlada; no demostrar la carrera solo con mocks o demoras arbitrarias.
- [ ] Probar instante exacto, espera del bloqueo que cruza el plazo y reintento tras aceptación cuya respuesta se perdió.
- [ ] Verificar una única liberación y ninguna ocupación liberada de una revisión/venta confirmada.
- [ ] Verificar comprobante guardado antes del plazo con primer aviso tardío: rechazo sin reactivar.

No aplica interfaz en esta tarea. La matriz completa y los detalles pendientes están en el contrato. No hay migración, proceso periódico ni prueba de carrera implementados por esta entrega documental.
