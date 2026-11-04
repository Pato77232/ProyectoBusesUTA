# BOOK-04 T1c: Datos completos del pasajero

- **ID local:** BOOK-04-T1c
- **Módulo:** bookings
- **Responsable:** Leslie Coello
- **Revisor propuesto:** Pablo, conforme a la preferencia actual de Leslie; aprobación pendiente.
- **Estado:** Especificación de tarea autorizada por Leslie al pedir continuar con las tareas independientes. No presupone aprobación de otros integrantes.
- **Reglas:** RN-42; datos declarados de RN-43 sin acreditación automática.
- **Dependencias:** BOOK-04 T1/T1b y decisiones de reservas.
- **Rama:** feature/BOOK-04-T1c-datos-pasajero.
- **Base:** feature/BOOK-05-T2-calcula-descuentos (19fe2d8), que contiene los validadores existentes. No se mezcla con el PR documental #12 ni se incorpora flota por merge.

## Objetivo y alcance
Crear un objeto de dominio de pasajero con asiento, cédula ecuatoriana, nombre completo y fecha de nacimiento. Es independiente de la tabla de reservas, viajes y pagos. No introduce HTTP, formularios, almacenamiento, acreditación de discapacidad ni consultas externas.

## Contrato
`createPassengerDetails(input, { onDate })` recibe exactamente los campos `seatId`, `identificationNumber`, `fullName`, `birthDate`. El contexto `onDate` es una fecha local de referencia del servidor, explícita: no proviene del cuerpo HTTP futuro ni del reloj del navegador.

- Asiento y cédula usan `createPassenger` y `createEcuadorianIdentification`, conservando los ceros iniciales y validando módulo 10. No se altera el objeto mínimo ni sus pruebas anteriores.
- El nombre es texto no vacío tras trim y debe contener al menos una letra Unicode; se conservan acentos, nombres de una palabra y puntuación. Se rechazan controles ASCII. No certifica un nombre real ni exige dos apellidos.
- Nacimiento y referencia son fechas locales exactas `YYYY-MM-DD`, años civiles 0001–9999 y días realmente existentes. Rechazar nacimiento posterior a la referencia y referencia ausente/inválida. Se admite nacimiento en la misma fecha; no se inventa una edad mínima o máxima.
- Rechazar campos extra, incluidos precio, descuento, cooperativa y banderas de verificación. El resultado es una copia inmutable; no se añaden edad, elegibilidad ni certificaciones.
- No aplicar el algoritmo ecuatoriano a pasaportes o documentos extranjeros. Ese soporte permanece en una tarea aparte.

## Criterios de aceptación y pruebas
- Componer los validadores existentes con cédulas sintéticas de verificador correcto.
- Rechazar cédula incompleta, numérica, verificador incorrecto o ausente y asiento vacío.
- Aceptar nombres con acentos y apóstrofes; rechazar blancos, números sin letras y controles.
- Aceptar fechas bisiestas válidas; rechazar días imposibles, formatos alternativos y fechas futuras.
- Probar referencia explícita, nacimiento en la referencia, años 0099/0100 y cambios de mes/año sin depender de zona horaria del equipo.
- Comprobar inmutabilidad, conservación de entrada y rechazo de propiedades de acreditación.

## Validación y entrega
Ejecutar lint, formato y npm test; registrar resultados reales en reservas-ejecucion.md. El dominio se prueba sin base de datos. Si el entorno de integración falla, conservar sus pruebas y reportar el fallo completo. No afirmar que el módulo de reservas está terminado por completar esta tarea.

Mensaje previsto: `feat(reservas): valida los datos completos del pasajero`.

## Defecto inducido
No aplica.

## Resultado de la tarea — 25 de octubre de 2026
Implementada como incremento de dominio, pendiente de revisión humana. 65 pruebas nuevas; 368 unitarias aprobadas en total. Lint, formato de producción y formato de pruebas nuevas aprobados. npm test completo sigue fallido: 4 HTTP aprobadas y 77 pruebas de integración fallidas por ausencia de URL/base PostgreSQL; motor Docker no disponible. No se modificaron pruebas previas, migraciones, dependencias, endpoints ni el PR documental #12.
