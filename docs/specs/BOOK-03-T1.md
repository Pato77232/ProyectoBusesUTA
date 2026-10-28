# BOOK-03 T1: resumen y creación inicial de dominio

- Responsable: Leslie Coello. Revisor propuesto por Leslie: PabloToapanta.
- Fecha: 27 de octubre de 2026. Estado: A y B implementadas localmente; revisión humana pendiente. Especificación previa a código, autorizada por Leslie.
- Base: origin/develop e96a277, que ya incorpora el PR #15. Rama: feature/BOOK-03-resumen-creacion-dominio.
- Reglas: RN-02, RN-40/41/42/43 y RN-50; decisiones de reservas existentes.

## Resultado y dos partes de la misma entrega
A. Componer el resumen completo de compra con pasajeros, tramo y cotización. B. Construir el valor inicial de reserva tras aceptación explícita, con identidad de servidor y plazo configurable. Un commit por parte; no proponer un PR por cada commit. Esta entrega es dominio puro y no reserva asientos realmente.

## A. Resumen
Entrada permitida: tripId, fromPosition, toPosition, seatIds y passengers. Rechazar campos extra, incluidos propietario, cooperativa, precios, descuentos, estado o plazo. Reutilizar las validaciones de disponibilidad y de un pasajero completo por asiento; comprobar que cada asiento pertenece a la plantilla y que el tramo existe.

Contexto interno de servidor, todavía sin adaptador de producción: onDate local actual; trip con tripId, cooperativeId, routePointCount, seatIds, departureDate local y segmentPricesCents de todos los tramos consecutivos (longitud routePointCount - 1); passengerBenefits con una entrada {seatId, disabilityVerified} por asiento seleccionado. El valor booleano debe ser explícito y provenir del servidor, no del cliente. No es una firma impuesta a David o Edwin.

Rechazar salida anterior a onDate, tarifas no enteras positivas o longitud incorrecta, beneficios ausentes/repetidos/ajenos y desbordamiento de enteros. Usar solo los precios desde fromPosition hasta toPosition, cobrar y redondear por pasajero mediante quotePassenger y sumar base, descuento y total en centavos seguros. Mantener la política ya decidida; no acumular descuentos.

El resumen contiene contexto del viaje/tramo, moneda USD, pasajeros ordenados por la selección con su cotización, y totales globales. Es una copia inmutable. Es información privada del futuro comprador, no una respuesta pública de disponibilidad. El cálculo de descuentos con edad declarada no acredita identidad o elegibilidad oficial; la verificación/revisión sigue pendiente del caso de uso y no se publica una compra verificada mediante esta función.

## B. Valor inicial de reserva
Entrada anterior más summaryAccepted, estrictamente true. Contexto de servidor adicional: bookingId y ownerId no vacíos, startedAt Date válido y proofWindowSeconds explícito entre 180 y 300. Scope inicial de este valor: comprador registrado ya resuelto por servidor; no implementar ni excluir de producto la política futura de invitado.

Recalcular el resumen con el contexto del servidor en vez de aceptar un total del cliente. Construir {bookingId, ownerId, status, summary, createdAt, expiresAt}, con estado interno PENDING_PAYMENT y fechas ISO inmutables. Reutilizar createBookingDeadline; no iniciar reloj al consultar el resumen, generar IDs ni leer reloj/configuración global dentro del dominio. El nombre de estado es interno y no constituye un contrato HTTP ni un esquema acordado con pagos.

No aceptar el resumen no crea un valor de reserva. Construirlo no persiste ni bloquea: BOOK-03 T2/T3 deberá revalidar bajo bloqueo, resolver identidad/acreditación y aceptar todos los asientos atómicamente. Versionado del resumen, cambio de precio e idempotencia de creación siguen pendientes antes de escritura.

## Pruebas y aceptación
- Composición real de pasajeros y cotizaciones, orden, descuentos sin acumulación y suma con redondeo individual.
- Tramo/plantilla ajenos, intentos de inyectar valores del cliente, tarifas/beneficios inválidos, enteros que desbordan y fechas inválidas producen BookingValidationError.
- Entradas congeladas conservadas; cotizaciones, pasajeros, listas y objetos del resultado inmutables, sin compartir referencias mutables de entrada.
- El resumen no tiene ID de reserva, propietario, vencimiento ni estado reservado.
- Solo aceptación true permite el valor inicial; IDs y plazo proceden del contexto del servidor.
- Plazos extremos, timestamp inválido/desbordado y mutación posterior de startedAt no alteran el resultado.

Ejecutar lint, formato de reservas y npm test; integración usa solo PostgreSQL aislado. No alterar pruebas previas ni inventar aceptación de fallos. Sin interfaz ni defecto inducido. Aplicar S por función y reutilización del dominio; no hacen falta puertos/clases nuevas para estas operaciones puras. Doble/adaptador de proveedor y pruebas de concurrencia serán tareas posteriores.

## Dependencias y límite de implementación
No hay aún API real de viajes ni de plantillas en esta base. T2, T3 y T4 siguen pendientes de sus contratos. El contrato de comprobantes del PR #17, aprobado por Shirley y aún abierto, no se modifica ni se implementa en esta tarea.

## Evidencia A — resumen
27 de octubre de 2026: parte A implementada con 45 pruebas nuevas. Lint y formato de código/pruebas de bookings aprobados. npm test: 595 unitarias y 4 de integración aprobadas; 103 de integración fallidas por falta de URL/base de pruebas. Se intentó iniciar Docker Desktop sin éxito; no se utilizaron bases existentes. Formato global reporta 27 archivos preexistentes ajenos. Parte B pendiente en este punto; no se presenta reserva persistida ni acreditación oficial de descuentos.

## Evidencia B — aceptación y valor inicial
Parte B completada el 27 de octubre de 2026 con 36 pruebas nuevas. La entrega A+B agrega 81 pruebas; verificación final: 631 unitarias aprobadas, lint y formato de reservas aprobados. npm test completo sigue fallido: 4 de integración aprobadas y 103 fallidas por ausencia de URL/base de pruebas; el motor Docker no está disponible. Formato global mantiene 27 archivos preexistentes ajenos. Ningún cambio en pruebas previas, migraciones, dependencias o módulos ajenos.

El valor inicial vuelve a construir el resumen con contexto de servidor, exige aceptación true y conserva fechas ISO sin compartir el Date mutable. No demuestra ni promete reserva persistida, protección concurrente, acreditación o aceptación de un precio cambiado: el futuro caso de uso deberá comprobar el resumen aceptado y resolver su versión antes de escribir. Ambos commits pertenecen a la misma entrega, no se recomienda un PR por paso. Faltan contratos reales, revisión humana, integración y pruebas de bloqueo en PostgreSQL.
